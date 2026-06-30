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
  input_modalities?: string[];
  output_modalities?: string[];
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
// Verified against live llm.chutes.ai/v1/models — these are TEE vision models
// that Chutes advertises with input_modalities including "image".
const VISION_FALLBACKS = [
  "Qwen/Qwen3.6-27B-TEE",
  "google/gemma-4-31B-turbo-TEE",
  "Qwen/Qwen3.5-397B-A17B-TEE",
  "moonshotai/Kimi-K2.6-TEE",
  "moonshotai/Kimi-K2.5-TEE",
];

function hasImageInput(arr: string[] | undefined): boolean {
  return !!arr?.some((c) => c.toLowerCase() === "image");
}

function isProbablyVisionModel(m: ChutesModel): boolean {
  if (m.supports_vision === true) return true;
  if (m.capabilities?.some((c) => c.toLowerCase().includes("vision"))) {
    return true;
  }
  if (hasImageInput(m.modalities)) return true;
  if (hasImageInput(m.input_modalities)) return true;
  const id = (m.id ?? "").toLowerCase();
  return VISION_HINTS.some((h) => id.includes(h));
}

function looksConfidential(m: ChutesModel): boolean {
  if (m.confidential_compute === true) return true;
  return (m.id ?? "").toUpperCase().endsWith("-TEE");
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
    const aT = looksConfidential(a) ? 1 : 0;
    const bT = looksConfidential(b) ? 1 : 0;
    return bT - aT;
  });
  const choice = teeFirst[0];
  if (choice) {
    return { id: choice.id, isConfidential: looksConfidential(choice) };
  }

  // Catalog didn't surface a vision model our heuristic recognises. Try the
  // known-good list — if any id is present in the catalog use it; otherwise
  // attempt the first fallback and let upstream error speak.
  const idSet = new Set(models.map((m) => m.id));
  for (const f of VISION_FALLBACKS) {
    if (idSet.has(f)) {
      return { id: f, isConfidential: f.toUpperCase().endsWith("-TEE") };
    }
  }
  const first = VISION_FALLBACKS[0];
  return { id: first, isConfidential: first.toUpperCase().endsWith("-TEE") };
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

export interface Annotation {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface AnnotateInput {
  accessToken: string;
  imageBase64: string;
  imageMime: string;
  question: string;
  answer: string;
}

// Ask the vision model to mark up to 3 regions of the screenshot the answer
// refers to. Returns an empty array on any failure or low confidence —
// annotations are optional polish and must never break the main answer flow.
export async function getAnnotations(
  input: AnnotateInput,
): Promise<{ annotations: Annotation[]; modelId: string }> {
  const picked = await pickVisionModel(input.accessToken);
  const systemPrompt = [
    "You are an annotation helper for a screen tutor.",
    "You receive a screenshot, a user's question, and the textual answer that was given.",
    "Identify up to 3 distinct UI regions in the screenshot that the answer is pointing at.",
    "Coordinates MUST be fractional from 0 to 1 with (0,0) at the top-left of the image.",
    "Each region has x, y (top-left corner), w, h (width, height), and a short label (max 24 chars) describing what to do there.",
    "If the answer is generic or you cannot locate specific regions with high confidence, return an empty annotations array.",
    'Reply with ONLY valid JSON in this exact shape and nothing else: {"annotations":[{"x":0.1,"y":0.2,"w":0.1,"h":0.05,"label":"Settings"}]}',
    "Do not wrap the JSON in markdown fences. Do not explain it.",
  ].join(" ");

  const userText = `Question: ${input.question}\n\nAnswer: ${input.answer}\n\nMark the UI regions the answer is pointing at.`;

  const body = {
    model: picked.id,
    stream: false,
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.imageMime};base64,${input.imageBase64}`,
            },
          },
        ],
      },
    ],
  };

  const r = await fetch(`${env.CHUTES_INFERENCE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(
      `Chutes annotate failed: ${r.status} ${await r.text().catch(() => "")}`,
    );
  }

  const json = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";

  return { annotations: parseAnnotations(content), modelId: picked.id };
}

function parseAnnotations(content: string): Annotation[] {
  const match = content.match(/\{[\s\S]*?"annotations"[\s\S]*\}/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const arr = (parsed as { annotations?: unknown }).annotations;
  if (!Array.isArray(arr)) return [];
  const out: Annotation[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const x = typeof a.x === "number" ? a.x : NaN;
    const y = typeof a.y === "number" ? a.y : NaN;
    const w = typeof a.w === "number" ? a.w : NaN;
    const h = typeof a.h === "number" ? a.h : NaN;
    const label = typeof a.label === "string" ? a.label.slice(0, 32) : "";
    if (
      !Number.isFinite(x) || x < 0 || x > 1 ||
      !Number.isFinite(y) || y < 0 || y > 1 ||
      !Number.isFinite(w) || w <= 0 || w > 1 ||
      !Number.isFinite(h) || h <= 0 || h > 1 ||
      x + w > 1.001 || y + h > 1.001 ||
      !label
    ) {
      continue;
    }
    out.push({ x, y, w, h, label });
    if (out.length >= 3) break;
  }
  return out;
}
