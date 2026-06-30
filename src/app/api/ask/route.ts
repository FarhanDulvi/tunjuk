import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { streamVisionAnswer } from "@/lib/chutes";
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

interface AskBody {
  question?: string;
  imageBase64?: string;
  imageMime?: string;
}

interface UpstreamError {
  status: number;
  message: string;
  text: string;
}

function stripDataUrlPrefix(s: string): { data: string; mime?: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(s.trim());
  if (m) return { mime: m[1], data: m[2] };
  return { data: s };
}

async function consumeUpstreamError(upstream: Response): Promise<UpstreamError> {
  const text = await upstream.text().catch(() => "");
  let message = "";
  const trimmed = text.trim();
  if (trimmed.length > 0) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        const p = parsed as {
          error?: unknown;
          error_description?: unknown;
          message?: unknown;
          detail?: unknown;
        };
        const pickString = (v: unknown): string | undefined => {
          if (typeof v === "string" && v.length > 0) return v;
          if (v && typeof v === "object") {
            const inner = (v as { message?: unknown }).message;
            if (typeof inner === "string" && inner.length > 0) return inner;
          }
          return undefined;
        };
        message =
          pickString(p.error_description) ??
          pickString(p.message) ??
          pickString(p.detail) ??
          pickString(p.error) ??
          "";
      }
    } catch {
      // not JSON; fall through to raw text fallback
    }
    if (!message) message = trimmed.slice(0, 240);
  }
  if (!message) message = `Upstream returned HTTP ${upstream.status}.`;
  return { status: upstream.status, message, text };
}

function isQuotaError(status: number, message: string): boolean {
  if (status === 402) return true;
  return /quota|balance|insufficient|exhausted|payment required|out of credits|no credits/i.test(
    message,
  );
}

function chutesRequestFailedResponse(err: unknown): NextResponse {
  const e = err as { message?: unknown; name?: unknown; cause?: unknown };
  const rawMessage =
    typeof e?.message === "string" && e.message.length > 0
      ? e.message
      : "Upstream inference service error.";
  const name = typeof e?.name === "string" ? e.name : undefined;
  let causeHint: string | undefined;
  if (e?.cause !== undefined && e?.cause !== null) {
    const c = e.cause as { message?: unknown; code?: unknown };
    if (typeof c?.message === "string" && c.message.length > 0) {
      causeHint = c.message;
    } else if (typeof c?.code === "string" && c.code.length > 0) {
      causeHint = c.code;
    } else if (typeof e.cause === "string") {
      causeHint = e.cause;
    }
  }
  const hintParts = [name, causeHint].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const message =
    hintParts.length > 0 ? `${rawMessage} (${hintParts.join(": ")})` : rawMessage;
  return NextResponse.json(
    { error: "chutes_request_failed", message },
    { status: 502 },
  );
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in with Chutes first." },
      { status: 401 },
    );
  }

  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "missing_question" }, { status: 400 });
  }
  if (!body.imageBase64) {
    return NextResponse.json({ error: "missing_image" }, { status: 400 });
  }

  const { data, mime } = stripDataUrlPrefix(body.imageBase64);

  const ALLOWED_MIME = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ]);
  const finalMime = body.imageMime ?? mime ?? "image/png";
  if (!ALLOWED_MIME.has(finalMime)) {
    return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "question_too_long" }, { status: 400 });
  }
  if (data.length > 20_000_000) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  const askInput = { question, imageBase64: data, imageMime: finalMime };

  // Attempt 1: the user's own Chutes wallet.
  let upstream: Response;
  let modelId: string;
  let isConfidential = false;
  let usedDemo = false;

  try {
    const r = await streamVisionAnswer({
      accessToken: session.accessToken,
      ...askInput,
    });
    upstream = r.upstream;
    modelId = r.modelId;
    isConfidential = r.isConfidential;
  } catch (err) {
    console.error("[ask] Chutes error:", err);
    return chutesRequestFailedResponse(err);
  }

  // If the first call failed with a quota / insufficient-balance error, try
  // once more with the project-sponsored demo key (when the user still has
  // demo allowance left). Any other upstream error surfaces unchanged.
  if (!upstream.ok || !upstream.body) {
    const err = await consumeUpstreamError(upstream);

    if (isQuotaError(err.status, err.message)) {
      if (!isDemoEnabled()) {
        return NextResponse.json(
          {
            error: "quota_exceeded",
            message: `Your Chutes wallet is empty. Top up at ${TOP_UP_URL} to continue.`,
            topUpUrl: TOP_UP_URL,
          },
          { status: 402 },
        );
      }

      const userId = getUserId(session);
      if (!userId) {
        return NextResponse.json(
          {
            error: "quota_exceeded",
            message: `Your Chutes wallet is empty. Top up at ${TOP_UP_URL} to continue.`,
            topUpUrl: TOP_UP_URL,
          },
          { status: 402 },
        );
      }

      const used = await getDemoUsed(userId);
      if (used >= DEMO_LIMIT) {
        return NextResponse.json(
          {
            error: "demo_exhausted",
            message: `You've used all ${DEMO_LIMIT} free Tunjuk-sponsored prompts. Top up your Chutes wallet at ${TOP_UP_URL} to keep going.`,
            topUpUrl: TOP_UP_URL,
            used,
            limit: DEMO_LIMIT,
          },
          { status: 402 },
        );
      }

      try {
        const retry = await streamVisionAnswer({
          accessToken: env.CHUTES_DEMO_KEY,
          ...askInput,
        });
        if (!retry.upstream.ok || !retry.upstream.body) {
          const retryErr = await consumeUpstreamError(retry.upstream);
          return NextResponse.json(
            {
              error: "demo_retry_failed",
              message: `Demo fallback also failed: ${retryErr.message}`,
            },
            { status: 502 },
          );
        }
        await incrementDemoUsed(userId);
        upstream = retry.upstream;
        modelId = retry.modelId;
        isConfidential = retry.isConfidential;
        usedDemo = true;
      } catch (retryErr) {
        console.error("[ask] demo retry error:", retryErr);
        return chutesRequestFailedResponse(retryErr);
      }
    } else {
      return NextResponse.json(
        {
          error: "chutes_upstream_error",
          status: err.status,
          message: err.message,
          body: err.text.slice(0, 1000),
        },
        { status: 502 },
      );
    }
  }

  const safeModelId = modelId.replace(/[^\x20-\x7E]/g, "").slice(0, 128);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Tunjuk-Model": safeModelId,
      "X-Tunjuk-Tee": isConfidential ? "1" : "0",
      "X-Tunjuk-Demo": usedDemo ? "1" : "0",
    },
  });
}
