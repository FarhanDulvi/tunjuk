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

  let upstream: Response;
  let modelId: string;
  try {
    const result = await streamVisionAnswer({
      accessToken: session.accessToken,
      question,
      imageBase64: data,
      imageMime: body.imageMime ?? mime ?? "image/png",
    });
    upstream = result.upstream;
    modelId = result.modelId;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Chutes inference failed.";
    return NextResponse.json(
      { error: "chutes_request_failed", message },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: "chutes_upstream_error",
        status: upstream.status,
        body: text.slice(0, 1000),
      },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Tunjuk-Model": modelId,
      "X-Tunjuk-Tee": modelId.toLowerCase().includes("tee") ? "1" : "0",
    },
  });
}
