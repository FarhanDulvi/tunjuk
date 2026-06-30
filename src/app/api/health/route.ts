import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { listModels, type ChutesModel } from "@/lib/chutes";
import { env } from "@/lib/env";
import { isDemoEnabled } from "@/lib/quota";

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

  if (check === "demo") {
    // Diagnostic for the per-user demo tier. Reports which env vars are wired
    // WITHOUT exposing their values, so we can curl this and see why the
    // chip isn't showing in the UI.
    const candidateUrlNames = [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_KV_REST_API_URL",
      "UPSTASH_REDIS_KV_URL",
      "KV_REST_API_URL",
      "STORAGE_KV_REST_API_URL",
    ];
    const candidateTokenNames = [
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_KV_REST_API_TOKEN",
      "KV_REST_API_TOKEN",
      "STORAGE_KV_REST_API_TOKEN",
    ];
    const urlName = candidateUrlNames.find((n) => !!process.env[n]);
    const tokenName = candidateTokenNames.find((n) => !!process.env[n]);
    const upstashVars = Object.keys(process.env)
      .filter((k) => /UPSTASH|^KV_|^STORAGE_/i.test(k))
      .sort();
    return NextResponse.json({
      enabled: isDemoEnabled(),
      hasUrl: !!env.UPSTASH_REDIS_REST_URL,
      hasToken: !!env.UPSTASH_REDIS_REST_TOKEN,
      hasDemoKey: !!env.CHUTES_DEMO_KEY,
      urlName: urlName ?? null,
      tokenName: tokenName ?? null,
      upstashVars,
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
