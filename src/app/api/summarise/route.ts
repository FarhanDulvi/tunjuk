import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { summariseTranscript } from "@/lib/chutes-text";
import { env } from "@/lib/env";
import {
  DEMO_LIMIT,
  getDemoUsed,
  getUserId,
  incrementDemoUsed,
  isDemoEnabled,
} from "@/lib/quota";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOP_UP_URL = "https://chutes.ai/billing";

interface SummariseBody {
  transcript?: string;
}

function isQuotaErrorMessage(message: string): boolean {
  return /\b402\b|quota|balance|insufficient|exhausted|payment required|out of credits|no credits/i.test(
    message,
  );
}

function friendlyError(message: string): string {
  // Strip the noisy `Chutes summarise failed: 402 {…}` wrapper so the user
  // sees the actual upstream complaint.
  const stripped = message.replace(/^Chutes summarise failed:\s*\d*\s*/i, "");
  if (isQuotaErrorMessage(message)) {
    return `Your Chutes wallet is empty (and the Tunjuk demo allowance is exhausted or unavailable for this account). Top up at ${TOP_UP_URL} to keep using Tunjuk.`;
  }
  if (stripped.length === 0) return message;
  return stripped.slice(0, 300);
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in with Chutes first." },
      { status: 401 },
    );
  }

  let body: SummariseBody;
  try {
    body = (await req.json()) as SummariseBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "missing_transcript" }, { status: 400 });
  }
  if (transcript.length > 32_000) {
    return NextResponse.json(
      { error: "transcript_too_long" },
      { status: 400 },
    );
  }

  // Attempt 1: user's own Chutes wallet.
  try {
    const { summary, modelId } = await summariseTranscript({
      accessToken: session.accessToken,
      transcript,
    });
    return NextResponse.json({ summary, modelId });
  } catch (err) {
    const firstMsg = err instanceof Error ? err.message : String(err);
    console.error("[summarise] user-wallet error:", firstMsg);

    // If it looks like a quota error AND the demo tier is configured, try once
    // more with the project-sponsored key (when the user still has allowance).
    if (isQuotaErrorMessage(firstMsg) && isDemoEnabled()) {
      const userId = getUserId(session);
      if (userId) {
        const used = await getDemoUsed(userId);
        if (used < DEMO_LIMIT) {
          try {
            const { summary, modelId } = await summariseTranscript({
              accessToken: env.CHUTES_DEMO_KEY,
              transcript,
            });
            await incrementDemoUsed(userId);
            return NextResponse.json({ summary, modelId, usedDemo: true });
          } catch (retryErr) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            console.error("[summarise] demo retry error:", retryMsg);
            return NextResponse.json(
              {
                error: "demo_retry_failed",
                message: friendlyError(retryMsg),
              },
              { status: 502 },
            );
          }
        }
        return NextResponse.json(
          {
            error: "demo_exhausted",
            message: `You've used all ${DEMO_LIMIT} free Tunjuk-sponsored prompts. Top up your Chutes wallet at ${TOP_UP_URL} to keep going.`,
            topUpUrl: TOP_UP_URL,
          },
          { status: 402 },
        );
      }
    }

    // Non-quota error, or quota with no demo path — surface the real message.
    return NextResponse.json(
      {
        error: "chutes_request_failed",
        message: friendlyError(firstMsg),
      },
      { status: 502 },
    );
  }
}
