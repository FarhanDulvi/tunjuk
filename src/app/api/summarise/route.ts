import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { summariseTranscript } from "@/lib/chutes-text";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SummariseBody {
  transcript?: string;
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

  try {
    const { summary, modelId } = await summariseTranscript({
      accessToken: session.accessToken,
      transcript,
    });
    return NextResponse.json({ summary, modelId });
  } catch (err) {
    console.error("[summarise] Chutes error:", err);
    return NextResponse.json(
      {
        error: "chutes_request_failed",
        message: "Upstream inference service error.",
      },
      { status: 502 },
    );
  }
}
