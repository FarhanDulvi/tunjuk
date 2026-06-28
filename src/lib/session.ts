// HttpOnly session cookie helpers. Stores Chutes OAuth tokens server-side only.
//
// Threat model:
//   - Access token never reaches client JS (HttpOnly).
//   - Token payload sealed with AES-GCM keyed off SESSION_SECRET.
//   - SameSite=lax allows the OAuth redirect callback to read the PKCE cookies.

import { cookies } from "next/headers";
import { env } from "@/lib/env";

const SESSION_COOKIE = "tunjuk_session";
const PKCE_VERIFIER_COOKIE = "tunjuk_pkce_verifier";
const OAUTH_STATE_COOKIE = "tunjuk_oauth_state";

export interface Session {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  user?: {
    sub?: string;
    username?: string;
    email?: string;
    name?: string;
  };
}

async function deriveKey(): Promise<CryptoKey> {
  const secret = env.SESSION_SECRET;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

function base64ToBytes(b64: string): Uint8Array {
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

async function seal(plain: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  const ctBytes = new Uint8Array(ct);
  const combined = new Uint8Array(iv.length + ctBytes.length);
  combined.set(iv, 0);
  combined.set(ctBytes, iv.length);
  return bytesToBase64(combined);
}

async function open(sealed: string): Promise<string | null> {
  try {
    const key = await deriveKey();
    const bytes = base64ToBytes(sealed);
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const sealed = await seal(JSON.stringify(session));
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: sealed,
    httpOnly: true,
    secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const json = await open(raw);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { accessToken?: unknown }).accessToken !== "string" ||
      typeof (parsed as { expiresAt?: unknown }).expiresAt !== "number"
    ) {
      return null;
    }
    const session = parsed as Session;
    if (session.expiresAt < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export async function savePkceState(
  verifier: string,
  state: string,
): Promise<void> {
  const store = await cookies();
  const isHttps = env.NEXT_PUBLIC_APP_URL.startsWith("https://");
  store.set({
    name: PKCE_VERIFIER_COOKIE,
    value: verifier,
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  store.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function consumePkceState(): Promise<{
  verifier?: string;
  state?: string;
}> {
  const store = await cookies();
  const verifier = store.get(PKCE_VERIFIER_COOKIE)?.value;
  const state = store.get(OAUTH_STATE_COOKIE)?.value;
  if (verifier !== undefined) {
    store.set({ name: PKCE_VERIFIER_COOKIE, value: "", path: "/", maxAge: 0 });
  }
  if (state !== undefined) {
    store.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  }
  return { verifier, state };
}
