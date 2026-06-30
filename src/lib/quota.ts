// Demo-tier prompt counter. Each signed-in user gets DEMO_LIMIT free prompts
// sponsored by the project's Chutes wallet (CHUTES_DEMO_KEY) when their own
// wallet returns a quota error. Counter lives in Upstash Redis keyed by user
// id so it is durable per user, not per session.
//
// If any of the demo env vars are missing the entire tier is disabled and
// every helper degrades to "no demo allowance left" so callers always see a
// safe, conservative answer.

import { env } from "@/lib/env";

export const DEMO_LIMIT = 20;

function keyFor(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
  return `tunjuk:demo:${safe}`;
}

export function isDemoEnabled(): boolean {
  return (
    !!env.CHUTES_DEMO_KEY &&
    !!env.UPSTASH_REDIS_REST_URL &&
    !!env.UPSTASH_REDIS_REST_TOKEN
  );
}

export async function getDemoUsed(userId: string): Promise<number> {
  if (!isDemoEnabled()) return DEMO_LIMIT;
  const key = encodeURIComponent(keyFor(userId));
  try {
    const r = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      cache: "no-store",
    });
    if (!r.ok) return 0;
    const j = (await r.json()) as { result: string | null };
    if (j.result == null) return 0;
    const n = Number(j.result);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function incrementDemoUsed(userId: string): Promise<number> {
  if (!isDemoEnabled()) return DEMO_LIMIT;
  const key = encodeURIComponent(keyFor(userId));
  try {
    const r = await fetch(`${env.UPSTASH_REDIS_REST_URL}/incr/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      cache: "no-store",
    });
    if (!r.ok) return DEMO_LIMIT;
    const j = (await r.json()) as { result: number };
    return typeof j.result === "number" ? j.result : DEMO_LIMIT;
  } catch {
    return DEMO_LIMIT;
  }
}

export function getUserId(session: {
  user?: { sub?: string; email?: string; username?: string };
}): string | null {
  return (
    session.user?.sub ??
    session.user?.email ??
    session.user?.username ??
    null
  );
}
