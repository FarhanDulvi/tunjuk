import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { listModels, type ChutesModel } from "@/lib/chutes";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VISION_HINTS = [
  "vl",
  "vision",
  "qwen-vl",
  "llama-3.2-vision",
  "molmo",
  "internvl",
  "pixtral",
  "glm-4v",
];

function isProbablyVisionModel(m: ChutesModel): boolean {
  if (m.supports_vision === true) return true;
  if (m.capabilities?.some((c) => c.toLowerCase().includes("vision"))) {
    return true;
  }
  if (m.modalities?.some((c) => c.toLowerCase() === "image")) return true;
  const id = (m.id ?? "").toLowerCase();
  return VISION_HINTS.some((h) => id.includes(h));
}

export async function GET(req: NextRequest) {
  const check = new URL(req.url).searchParams.get("check");

  if (check === null) {
    return NextResponse.json({
      ok: true,
      version: process.env.npm_package_version ?? "0.1.0",
      time: new Date().toISOString(),
    });
  }

  if (check === "models") {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      const models = await listModels(session.accessToken);
      const visionModels = models.filter(isProbablyVisionModel);
      const vision = visionModels.length;
      const vision_tee = visionModels.filter(
        (m) => m.confidential_compute === true,
      ).length;
      const pinned_model = env.CHUTES_VISION_MODEL || "auto";
      return NextResponse.json({ vision, vision_tee, pinned_model });
    } catch (err) {
      console.error("[health] models check failed:", err);
      return NextResponse.json(
        {
          error: "chutes_request_failed",
          message: "Upstream inference service error.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: "unknown_check" }, { status: 400 });
}
