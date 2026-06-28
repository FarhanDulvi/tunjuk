import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { streamVisionAnswer } from "@/lib/chutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AskBody {
  question?: string;
  imageBase64?: string;
  imageMime?: string;
}

function stripDataUrlPrefix(s: string): { data: string; mime?: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(s.trim());
  if (m) return { mime: m[1], data: m[2] };
  return { data: s };
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

  let upstream: Response;
  let modelId: string;
  let isConfidential = false;
  try {
    const result = await streamVisionAnswer({
      accessToken: session.accessToken,
      question,
      imageBase64: data,
      imageMime: finalMime,
    });
    upstream = result.upstream;
    modelId = result.modelId;
    isConfidential = result.isConfidential;
  } catch (err) {
    console.error("[ask] Chutes error:", err);
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
      hintParts.length > 0
        ? `${rawMessage} (${hintParts.join(": ")})`
        : rawMessage;
    return NextResponse.json(
      {
        error: "chutes_request_failed",
        message,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
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
      if (!message) {
        message = trimmed.slice(0, 240);
      }
    }
    if (!message) {
      message = `Upstream returned HTTP ${upstream.status}.`;
    }
    return NextResponse.json(
      {
        error: "chutes_upstream_error",
        status: upstream.status,
        message,
        body: text.slice(0, 1000),
      },
      { status: 502 },
    );
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
    },
  });
}
