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
  const models = await listModels(accessToken);
  const visionModels = models.filter(isProbablyVisionModel);
  const teeFirst = visionModels.sort((a, b) => {
    const aT = a.confidential_compute ? 1 : 0;
    const bT = b.confidential_compute ? 1 : 0;
    return bT - aT;
  });
  const choice = teeFirst[0];
  if (!choice) {
    throw new Error(
      "No vision-capable Chutes model is currently available to your account.",
    );
  }
  return { id: choice.id, isConfidential: !!choice.confidential_compute };
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
