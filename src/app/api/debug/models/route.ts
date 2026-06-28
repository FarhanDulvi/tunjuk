// Diagnostics endpoint: surface exactly which Chutes models the signed-in
// user's token resolves to, so they can confirm their account sees the
// expected catalogue. Intentionally unlinked from the main UI — users hit
// this manually.

import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { listModels, type ChutesModel } from "@/lib/chutes";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vision-model heuristic, replicated locally to keep chutes.ts untouched.
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
  if (VISION_HINTS.some((h) => id.includes(h))) return true;
  return false;
}

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const models = await listModels(session.accessToken);

    const visionModels = models.filter(isProbablyVisionModel);
    const teeVisionModels = visionModels.filter(
      (m) => m.confidential_compute === true,
    );

    // Mirror pickVisionModel: env override wins, otherwise prefer TEE.
    let picked: { id: string; isConfidential: boolean } | null = null;
    if (env.CHUTES_VISION_MODEL) {
      picked = {
        id: env.CHUTES_VISION_MODEL,
        isConfidential: env.CHUTES_VISION_MODEL.toLowerCase().includes("tee"),
      };
    } else {
      const teeFirst = [...visionModels].sort((a, b) => {
        const aT = a.confidential_compute ? 1 : 0;
        const bT = b.confidential_compute ? 1 : 0;
        return bT - aT;
      });
      const choice = teeFirst[0];
      if (choice) {
        picked = {
          id: choice.id,
          isConfidential: !!choice.confidential_compute,
        };
      }
    }

    return NextResponse.json({
      total_models: models.length,
      vision_count: visionModels.length,
      tee_vision_count: teeVisionModels.length,
      picked_model: picked,
      sample_vision_ids: visionModels.slice(0, 10).map((m) => m.id),
      sample_tee_ids: teeVisionModels.slice(0, 10).map((m) => m.id),
    });
  } catch (err) {
    console.error("[debug/models] listModels failed:", err);
    return NextResponse.json(
      {
        error: "chutes_request_failed",
        message:
          err instanceof Error ? err.message : "Upstream inference service error.",
      },
      { status: 502 },
    );
  }
}
