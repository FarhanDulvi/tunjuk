"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VoiceInput } from "@/components/voice-input";
import { AnswerStream } from "@/components/answer-stream";
import {
  isDocumentPipSupported,
  useDocumentPip,
} from "@/components/pip-portal";

interface Capture {
  base64: string;
  mime: string;
}

interface TranscriptEntry {
  q: string;
  a: string;
}

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function ScreenShare() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [canScreenShare] = useState(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function",
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  // Browser feature detection. Returns false during SSR (window undefined) and
  // true on the client when Document PiP is available. Safe across hydration
  // because the float button is gated on `stream || capture`, both of which
  // are null on first paint on server and client.
  const [pipSupported] = useState(() => isDocumentPipSupported());
  const [inlineContainer, setInlineContainer] = useState<HTMLElement | null>(
    null,
  );
  const pip = useDocumentPip({ width: 420, height: 720 });
  const isFloating = pip.isOpen;
  const canFloat = pipSupported && (stream !== null || capture !== null);
  const askPanelTarget = pip.container ?? inlineContainer;
  async function openFloating() {
    try {
      await pip.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open the floating window.",
      );
    }
  }

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
    if (!canScreenShare) {
      setError(
        'Screen sharing is not supported in this browser. Use "Upload screenshot" below — your phone camera or photo library works.',
      );
      return;
    }
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

  function handleFile(file: File) {
    setError(null);
    const mime = file.type;
    if (!ALLOWED_MIME.includes(mime)) {
      setError(
        `Unsupported image type "${mime || "unknown"}". Use PNG, JPEG, WebP, or GIF.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setError("Could not read the selected file.");
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      if (!base64) {
        setError("Could not read the selected file.");
        return;
      }
      setCapture({ base64, mime });
    };
    reader.onerror = () => {
      setError("Could not read the selected file.");
    };
    reader.readAsDataURL(file);
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset value so picking the same file again still triggers onChange.
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
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

  const askPanel = (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">2. Ask Tunjuk</h2>
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
        <label htmlFor="tunjuk-question" className="sr-only">
          Your question
        </label>
        <textarea
          id="tunjuk-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How do I add auto-layout to this frame?"
          aria-label="Your question for Tunjuk"
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
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            1. Share your screen
          </h2>
          <p className="text-sm text-slate-600">
            Pick a window or tab, or upload a screenshot. Tunjuk processes one
            frame at a time — nothing is recorded.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {!stream ? (
            <button
              type="button"
              onClick={startShare}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Start screen share
            </button>
          ) : (
            <>
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
            </>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-600"
          >
            Upload a screenshot
          </button>
          {canFloat && !isFloating ? (
            <button
              type="button"
              onClick={openFloating}
              className="rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50"
              title="Open the Ask Tunjuk panel in a floating Picture-in-Picture window so you can switch apps while reading the answer."
            >
              📌 Float panel
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileInputChange}
            className="hidden"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        >
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full bg-black"
            />
          ) : capture ? (
            <div className="flex aspect-video w-full items-center justify-center bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${capture.mime};base64,${capture.base64}`}
                alt="Uploaded screenshot preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-400">
              <span>Drop a screenshot here, or use the buttons above.</span>
              <span className="text-xs text-slate-400">
                You can also drag-and-drop a screenshot into this box.
              </span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </section>

      {/*
        The inline container always stays mounted so the React element below
        keeps the same parent across float toggles. Only the portal *target*
        changes, which preserves child component state (e.g. AnswerStream's
        in-flight fetch and AttestationBadge / TtsPlayer internal refs).
      */}
      <div
        ref={setInlineContainer}
        className={isFloating ? "hidden" : "space-y-4"}
        aria-hidden={isFloating}
      />

      {isFloating ? (
        <button
          type="button"
          onClick={pip.close}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-6 text-center text-sm text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50"
        >
          <span className="text-2xl">📌</span>
          <span className="font-semibold">
            Panel is floating in a separate window
          </span>
          <span className="text-xs text-emerald-600/80">
            Click here to close the floating window and return the panel in
            place.
          </span>
        </button>
      ) : null}

      {askPanelTarget ? createPortal(askPanel, askPanelTarget) : null}
    </div>
  );
}
