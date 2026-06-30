"use client";

import { useEffect, useRef, useState } from "react";

import { AttestationBadge } from "@/components/attestation-badge";
import { PersistenceBadge } from "@/components/persistence-badge";
import { TtsPlayer } from "@/components/tts-player";
import { AnnotatedScreenshot } from "@/components/annotated-screenshot";
import type { Annotation } from "@/lib/chutes";

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
  const [ttfbMs, setTtfbMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setText("");
    setError(null);
    setDone(false);
    setTtfbMs(null);
    setTotalMs(null);
    setAnnotations([]);

    async function run() {
      const startedAt = performance.now();
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
                setTotalMs(performance.now() - startedAt);
                setDone(true);
                onDoneRef.current?.();
              }
              try {
                await reader.cancel();
              } catch {
                // ignore
              }
              return;
            }
            try {
              const chunk = JSON.parse(payload) as DeltaChunk;
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                if (!cancelled) {
                  setTtfbMs((prev) =>
                    prev == null ? performance.now() - startedAt : prev,
                  );
                }
                setText((prev) => prev + delta);
              }
            } catch {
              // ignore malformed line
            }
          }
        }
        if (!cancelled) {
          setTotalMs(performance.now() - startedAt);
          setDone(true);
          onDoneRef.current?.();
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (cancelled || e.name === "AbortError") return;
        setError(e.message);
        setDone(true);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [question, imageBase64, mimeType]);

  // After the streaming answer completes, fire one non-streaming call to ask
  // the model where to point in the screenshot. Failure is silent — the
  // answer panel just renders without arrows.
  useEffect(() => {
    if (!done || !text || error) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/annotate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            imageMime: mimeType,
            question,
            answer: text,
          }),
        });
        if (cancelled || !r.ok) return;
        const j = (await r.json()) as { annotations?: Annotation[] };
        if (Array.isArray(j.annotations) && !cancelled) {
          setAnnotations(j.annotations);
        }
      } catch {
        // ignore — annotations are optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [done, text, error, imageBase64, mimeType, question]);

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Tunjuk says
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <PersistenceBadge />
          <AttestationBadge tee={tee} modelId={modelId} />
          {modelId ? (
            <span
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-zinc-400"
              title={modelId}
            >
              Picked: {modelId.length > 28 ? modelId.slice(0, 26) + "…" : modelId}
            </span>
          ) : null}
          {done && ttfbMs != null && totalMs != null ? (
            <span
              className="text-[11px] font-mono text-zinc-500"
              title="First token / total stream"
            >
              ⚡ {(ttfbMs / 1000).toFixed(1)}s · {(totalMs / 1000).toFixed(1)}s total
            </span>
          ) : null}
          {done && text ? <TtsPlayer text={text} /> : null}
        </div>
      </header>
      {error ? (
        <p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-100">
          {text || (done ? "(empty response)" : "Thinking…")}
        </p>
      )}
      {annotations.length > 0 ? (
        <div className="mt-4">
          <AnnotatedScreenshot
            imageBase64={imageBase64}
            mimeType={mimeType}
            annotations={annotations}
          />
        </div>
      ) : null}
    </section>
  );
}
