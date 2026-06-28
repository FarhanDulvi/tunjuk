"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceInput } from "@/components/voice-input";
import { AnswerStream } from "@/components/answer-stream";

interface Capture {
  base64: string;
  mime: string;
}

interface TranscriptEntry {
  q: string;
  a: string;
}

export function ScreenShare() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(
    null,
  );
  const [submittedCapture, setSubmittedCapture] = useState<Capture | null>(
    null,
  );
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryModelId, setSummaryModelId] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const answerWrapperRef = useRef<HTMLDivElement | null>(null);

  const stopStream = useCallback(() => {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  async function startShare() {
    setError(null);
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      setStream(next);
      next.getVideoTracks()[0].addEventListener("ended", () => {
        setStream(null);
      });
    } catch (err) {
      setError(
        (err as Error).message ??
          "Could not start screen share. Please grant permission.",
      );
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError("Screen share is not ready yet — wait a moment and try again.");
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    setCapture({ base64, mime: "image/png" });
  }

  function submit() {
    if (!capture || !question.trim()) return;
    setSubmittedCapture(capture);
    setSubmittedQuestion(question.trim());
  }

  function reset() {
    setSubmittedCapture(null);
    setSubmittedQuestion(null);
  }

  function handleAnswerDone() {
    // Read the final answer text from the rendered AnswerStream DOM.
    // AnswerStream renders the answer inside a <p> element (the only <p>
    // descendant in its <section>). This avoids widening AnswerStream's
    // callback signature, which is owned by another batch.
    const root = answerWrapperRef.current;
    const q = submittedQuestion;
    if (!root || !q) return;
    const para = root.querySelector("p");
    const a = (para?.textContent ?? "").trim();
    if (!a || a === "Thinking…" || a === "(empty response)") return;
    setTranscript((prev) => [...prev, { q, a }]);
  }

  async function endSession() {
    if (transcript.length === 0 || summarising) return;
    setSummarising(true);
    setSummary(null);
    setSummaryError(null);
    setSummaryModelId(null);
    try {
      const text = transcript
        .map((t) => `Q: ${t.q}\nA: ${t.a}`)
        .join("\n\n");
      const r = await fetch("/api/summarise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        summary?: string;
        modelId?: string;
        message?: string;
        error?: string;
      };
      if (!r.ok) {
        throw new Error(body.message ?? body.error ?? `Failed: ${r.status}`);
      }
      setSummary(body.summary ?? "");
      setSummaryModelId(body.modelId ?? null);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Could not generate summary.",
      );
    } finally {
      setSummarising(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            1. Share your screen
          </h2>
          <p className="text-sm text-slate-600">
            Pick a window or tab. Tunjuk processes one frame at a time —
            nothing is recorded.
          </p>
        </header>

        {!stream ? (
          <button
            type="button"
            onClick={startShare}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Start screen share
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={captureFrame}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              📸 Capture frame
            </button>
            <button
              type="button"
              onClick={stopStream}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Stop sharing
            </button>
          </div>
        )}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-sm text-slate-400">
              No screen shared yet
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </section>

      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            2. Ask Tunjuk
          </h2>
          <p className="text-sm text-slate-600">
            Type a question, or speak it. Tunjuk sees the captured frame.
          </p>
        </header>

        {capture ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${capture.mime};base64,${capture.base64}`}
              alt="Captured screen frame"
              className="max-h-48 w-full object-contain bg-slate-100"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Capture a frame from your shared screen above.
          </div>
        )}

        <div className="space-y-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How do I add auto-layout to this frame?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            rows={3}
          />
          <div className="flex items-center justify-between gap-2">
            <VoiceInput onTranscript={setQuestion} />
            <button
              type="button"
              onClick={submit}
              disabled={!capture || !question.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ask Tunjuk
            </button>
          </div>
        </div>

        {submittedQuestion && submittedCapture ? (
          <div className="space-y-2">
            <div ref={answerWrapperRef}>
              <AnswerStream
                question={submittedQuestion}
                imageBase64={submittedCapture.base64}
                mimeType={submittedCapture.mime}
                onDone={handleAnswerDone}
              />
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              Ask another question
            </button>
          </div>
        ) : null}

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              Session transcript: {transcript.length}{" "}
              {transcript.length === 1 ? "exchange" : "exchanges"}
            </div>
            <button
              type="button"
              onClick={endSession}
              disabled={summarising || transcript.length === 0}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {summarising ? "Summarising…" : "End session — get summary"}
            </button>
          </div>

          {summaryError ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {summaryError}
            </p>
          ) : null}

          {summary ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Session summary
                </h4>
                {summaryModelId ? (
                  <span
                    className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-mono text-emerald-700"
                    title={summaryModelId}
                  >
                    {summaryModelId.length > 32
                      ? summaryModelId.slice(0, 30) + "…"
                      : summaryModelId}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {summary}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
