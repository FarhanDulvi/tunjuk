import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getAnnotations } from "@/lib/chutes";
import { env } from "@/lib/env";
import { isDemoEnabled } from "@/lib/quota";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AnnotateBody {
  imageBase64?: string;
  imageMime?: string;
  question?: string;
  answer?: string;
}

const EMPTY = { annotations: [] as never[] };

// Annotations are optional polish on top of the streaming answer. This route
// never throws or returns a non-200 because that would cascade into the UI as
// an error banner. Every failure path returns { annotations: [] } so the
// answer panel just renders without arrows.
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json(EMPTY);

  let body: AnnotateBody;
  try {
    body = (await req.json()) as AnnotateBody;
  } catch {
    return NextResponse.json(EMPTY);
  }

  const question = (body.question ?? "").trim();
  const answer = (body.answer ?? "").trim();
  const imageBase64 = body.imageBase64 ?? "";
  const imageMime = body.imageMime ?? "image/png";

  if (!question || !answer || !imageBase64) return NextResponse.json(EMPTY);
  if (imageBase64.length > 20_000_000) return NextResponse.json(EMPTY);

  const input = { imageBase64, imageMime, question, answer };

  try {
    const r = await getAnnotations({ accessToken: session.accessToken, ...input });
    return NextResponse.json({ annotations: r.annotations });
  } catch {
    if (isDemoEnabled()) {
      try {
        const r = await getAnnotations({ accessToken: env.CHUTES_DEMO_KEY, ...input });
        return NextResponse.json({ annotations: r.annotations });
      } catch {
        return NextResponse.json(EMPTY);
      }
    }
    return NextResponse.json(EMPTY);
  }
}
