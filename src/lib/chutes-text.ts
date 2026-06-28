// Lightweight, non-vision text model client for end-of-session summaries.
// Server-side only. Reuses listModels() from @/lib/chutes — does NOT
// duplicate fetch logic.

import { env } from "@/lib/env";
import { listModels, type ChutesModel } from "@/lib/chutes";

const TEXT_PREFERENCES = [
  "gemma-3",
  "gemma3",
  "llama-3.1-8b",
  "qwen2.5-7b",
  "mistral-7b",
  "phi-3",
  "smollm",
];

// Mirrors the heuristic in chutes.ts (kept local to avoid exporting internals).
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

function isVisionish(m: ChutesModel): boolean {
  if (m.supports_vision === true) return true;
  if (m.capabilities?.some((c) => c.toLowerCase().includes("vision"))) {
    return true;
  }
  if (m.modalities?.some((c) => c.toLowerCase() === "image")) return true;
  const id = (m.id ?? "").toLowerCase();
  return VISION_HINTS.some((h) => id.includes(h));
}

export async function pickTextModel(accessToken: string): Promise<string> {
  const override = process.env.CHUTES_TEXT_MODEL;
  if (override && override.length > 0) {
    return override;
  }

  const models = await listModels(accessToken);
  const textOnly = models.filter((m) => !isVisionish(m));

  for (const pref of TEXT_PREFERENCES) {
    const hit = textOnly.find((m) => (m.id ?? "").toLowerCase().includes(pref));
    if (hit) return hit.id;
  }

  // Fall back to the first text-only model if no preferred match.
  const fallback = textOnly[0];
  if (!fallback) {
    throw new Error(
      "No lightweight text Chutes model is currently available to your account.",
    );
  }
  return fallback.id;
}

export interface SummariseInput {
  accessToken: string;
  transcript: string;
}

export interface SummariseResult {
  summary: string;
  modelId: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

export async function summariseTranscript(
  input: SummariseInput,
): Promise<SummariseResult> {
  const modelId = await pickTextModel(input.accessToken);

  const systemPrompt =
    "You are a meeting note-taker. Summarise the following Q&A transcript from a screen-sharing tutor session in ONE concise paragraph (<=120 words). No headings, no bullets.";

  const body = {
    model: modelId,
    stream: false,
    max_tokens: 240,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input.transcript },
    ],
  };

  const r = await fetch(`${env.CHUTES_INFERENCE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(
      `Chutes summarise failed: ${r.status} ${text.slice(0, 500)}`,
    );
  }

  const json = (await r.json()) as ChatCompletionResponse;
  const summary = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { summary, modelId };
}
