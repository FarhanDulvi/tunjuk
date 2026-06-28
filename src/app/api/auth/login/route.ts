import { NextResponse } from "next/server";
import { env, callbackUrl } from "@/lib/env";
import { generatePkcePair, randomString } from "@/lib/pkce";
import { savePkceState } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const { verifier, challenge } = await generatePkcePair();
  const state = randomString(16);
  await savePkceState(verifier, state);

  const url = new URL(env.CHUTES_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.CHUTES_CLIENT_ID);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("scope", "openid profile chutes:invoke");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
