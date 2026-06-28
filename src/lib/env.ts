// Server-side env access with friendly errors when something is missing.

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable: ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get CHUTES_CLIENT_ID() {
    return required("CHUTES_CLIENT_ID", process.env.CHUTES_CLIENT_ID);
  },
  get CHUTES_CLIENT_SECRET() {
    return required("CHUTES_CLIENT_SECRET", process.env.CHUTES_CLIENT_SECRET);
  },
  get NEXT_PUBLIC_APP_URL() {
    return required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
  },
  get CHUTES_AUTHORIZE_URL() {
    return (
      process.env.CHUTES_AUTHORIZE_URL ?? "https://api.chutes.ai/idp/authorize"
    );
  },
  get CHUTES_TOKEN_URL() {
    return process.env.CHUTES_TOKEN_URL ?? "https://api.chutes.ai/idp/token";
  },
  get CHUTES_USERINFO_URL() {
    return (
      process.env.CHUTES_USERINFO_URL ?? "https://api.chutes.ai/idp/userinfo"
    );
  },
  get CHUTES_INFERENCE_URL() {
    return process.env.CHUTES_INFERENCE_URL ?? "https://llm.chutes.ai/v1";
  },
  get CHUTES_VISION_MODEL() {
    return process.env.CHUTES_VISION_MODEL ?? "";
  },
  get SESSION_SECRET() {
    return required("SESSION_SECRET", process.env.SESSION_SECRET);
  },
};

export function callbackUrl(): string {
  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
}
