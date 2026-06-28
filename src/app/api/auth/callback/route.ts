import { NextRequest, NextResponse } from "next/server";
import { env, callbackUrl } from "@/lib/env";
import { consumePkceState, saveSession, type Session } from "@/lib/session";

export const dynamic = "force-dynamic";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface UserInfoResponse {
  sub?: string;
  username?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

function errorRedirect(reason: string): NextResponse {
  const u = new URL(env.NEXT_PUBLIC_APP_URL);
  u.pathname = "/";
  u.searchParams.set("error", reason);
  return NextResponse.redirect(u.toString());
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  if (!code || !stateParam) return errorRedirect("missing_code");

  const { verifier, state } = await consumePkceState();
  if (!verifier || !state || state !== stateParam) {
    return errorRedirect("bad_state");
  }

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", callbackUrl());
  form.set("client_id", env.CHUTES_CLIENT_ID);
  form.set("client_secret", env.CHUTES_CLIENT_SECRET);
  form.set("code_verifier", verifier);

  const r = await fetch(env.CHUTES_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  let token: TokenResponse;
  try {
    token = (await r.json()) as TokenResponse;
  } catch {
    return errorRedirect("token_parse_failed");
  }

  if (!r.ok || !token.access_token) {
    return errorRedirect(token.error ?? "token_exchange_failed");
  }

  const session: Session = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt:
      Date.now() + (token.expires_in ? token.expires_in * 1000 : 60 * 60 * 1000),
  };

  try {
    const ui = await fetch(env.CHUTES_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (ui.ok) {
      const info = (await ui.json()) as UserInfoResponse;
      session.user = {
        sub: info.sub,
        username: info.preferred_username ?? info.username,
        email: info.email,
        name: info.name,
      };
    }
  } catch {
    // ignore — userinfo is best-effort
  }

  await saveSession(session);

  const dest = new URL(env.NEXT_PUBLIC_APP_URL);
  dest.pathname = "/app";
  return NextResponse.redirect(dest.toString());
}
