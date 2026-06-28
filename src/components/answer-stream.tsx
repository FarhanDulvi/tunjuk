"use client";

import { useEffect, useRef, useState } from "react";
import { AttestationBadge } from "@/components/attestation-badge";
import { TtsPlayer } from "@/components/tts-player";

interface Props {
  question: string;
  imageBase64: string;
  mimeType: string;
  onDone?: () => void;
}

interface DeltaChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
}

export function AnswerStream({
  question,
  imageBase64,
  mimeType,
  onDone,
}: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tee, setTee] = useState(false);
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setText("");
    setError(null);
    setDone(false);

    async function run() {
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, imageBase64, imageMime: mimeType }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { message?: string; error?: string }).message ??
              (body as { error?: string }).error ??
              `Request failed: ${res.status}`,
          );
        }

        setTee(res.headers.get("X-Tunjuk-Tee") === "1");
        const m = res.headers.get("X-Tunjuk-Model");
        if (m) setModelId(m);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              if (!cancelled) {
                setDone(true);
                onDone?.();
              }
              return;
            }
            try {
              const chunk = JSON.parse(payload) as DeltaChunk;
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                setText((prev) => prev + delta);
              }
            } catch {
              // ignore malformed line
            }
          }
        }
        if (!cancelled) {
          setDone(true);
          onDone?.();
        }
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setError((err as Error).message);
        setDone(true);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [question, imageBase64, mimeType, onDone]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tunjuk says
        </h3>
        <div className="flex items-center gap-2">
          <AttestationBadge tee={tee} modelId={modelId} />
          {done && text ? <TtsPlayer text={text} autoPlay /> : null}
        </div>
      </header>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
          {text || (done ? "(empty response)" : "Thinking…")}
        </p>
      )}
    </section>
  );
}
