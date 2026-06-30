// Chutes API client helpers. Server-side only.

import { env } from "@/lib/env";

export interface ChutesModel {
  id: string;
  object?: string;
  owned_by?: string;
  confidential_compute?: boolean;
  supports_vision?: boolean;
  capabilities?: string[];
  modalities?: string[];
}

export interface PickedModel {
  id: string;
  isConfidential: boolean;
}

const VISION_HINTS = [
  "vl",
  "vision",
  "qwen3-vl",
  "qwen2-vl",
  "qwen2.5-vl",
  "qwen-vl",
  "llama-3.2-vision",
  "llama-3.2-11b-vision",
  "llama-3.2-90b-vision",
  "molmo",
  "internvl",
  "pixtral",
  "glm-4v",
  "llava",
  "minicpm-v",
  "cogvlm",
  "phi-3.5-vision",
  "phi-3-vision",
  "idefics",
];

// Known-good vision model ids on Chutes. Used as a last-resort fallback when
// /v1/models returns no entries our heuristic recognises. Upstream surfaces
// a clearer error than ours if the user's plan doesn't include the model.
const VISION_FALLBACKS = [
  "Qwen/Qwen2.5-VL-32B-Instruct",
  "Qwen/Qwen2.5-VL-7B-Instruct",
  "meta-llama/Llama-3.2-11B-Vision-Instruct",
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

export async function listModels(accessToken: string): Promise<ChutesModel[]> {
  const url = `${env.CHUTES_INFERENCE_URL}/models`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error(`Chutes /models failed: ${r.status} ${await r.text()}`);
  }
  const json = (await r.json()) as { data?: ChutesModel[] };
  return json.data ?? [];
}

export async function pickVisionModel(
  accessToken: string,
): Promise<PickedModel> {
  if (env.CHUTES_VISION_MODEL) {
    return {
      id: env.CHUTES_VISION_MODEL,
      isConfidential: env.CHUTES_VISION_MODEL.toLowerCase().includes("tee"),
    };
  }
  let models: ChutesModel[] = [];
  try {
    models = await listModels(accessToken);
  } catch {
    // Catalog fetch failed entirely — drop straight to the fallback ladder so
    // the user still gets an attempt rather than a hard wall.
  }
  const visionModels = models.filter(isProbablyVisionModel);
  const teeFirst = visionModels.sort((a, b) => {
    const aT = a.confidential_compute ? 1 : 0;
    const bT = b.confidential_compute ? 1 : 0;
    return bT - aT;
  });
  const choice = teeFirst[0];
  if (choice) {
    return { id: choice.id, isConfidential: !!choice.confidential_compute };
  }

  // Catalog didn't surface a vision model our heuristic recognises. Try the
  // known-good list — if any id is present in the catalog use it; otherwise
  // attempt the first fallback and let upstream error speak.
  const idSet = new Set(models.map((m) => m.id));
  for (const f of VISION_FALLBACKS) {
    if (idSet.has(f)) {
      return { id: f, isConfidential: false };
    }
  }
  return { id: VISION_FALLBACKS[0], isConfidential: false };
}

export interface AskInput {
  question: string;
  imageBase64: string;
  imageMime?: string;
  accessToken: string;
  model?: string;
}

export async function streamVisionAnswer(
  input: AskInput,
): Promise<{ upstream: Response; modelId: string; isConfidential: boolean }> {
  const mime = input.imageMime ?? "image/png";
  const picked = input.model
    ? { id: input.model, isConfidential: false }
    : await pickVisionModel(input.accessToken);
  const modelId = picked.id;
  const isConfidential = picked.isConfidential;
  const systemPrompt = [
    "You are Tunjuk, an AI screen tutor that watches a user's shared screen.",
    "The user has uploaded a screenshot of what they are looking at and asked a question.",
    "Be concise and concrete. Reference specific UI elements visible in the screenshot.",
    "Prefer numbered step-by-step instructions when the user is asking how to do something.",
    "If the screen does not contain enough detail to answer, say so plainly and tell the user what to capture.",
  ].join(" ");

  const body = {
    model: modelId,
    stream: true,
    max_tokens: 800,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: input.question },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${input.imageBase64}` },
          },
        ],
      },
    ],
  };

  const upstream = await fetch(`${env.CHUTES_INFERENCE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  return { upstream, modelId, isConfidential };
}
