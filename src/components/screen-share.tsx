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

interface QuotaInfo {
  enabled: boolean;
  used: number;
  limit: number;
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
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryModelId, setSummaryModelId] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const answerWrapperRef = useRef<HTMLDivElement | null>(null);
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

  const fetchQuota = useCallback(async () => {
    try {
      const r = await fetch("/api/quota", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as QuotaInfo;
      setQuota(j);
    } catch {
      // ignore — chip just won't show
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  // Best-effort auto-float when the tab goes hidden. Most browsers preserve
  // the user-activation token for ~5s after the last gesture, so this works
  // when the user typed a question, clicked Ask, then switched tabs. If the
  // token has expired the call rejects silently.
  useEffect(() => {
    if (!canFloat || pip.isOpen) return;
    function onVis() {
      if (document.visibilityState === "hidden" && !pip.isOpen) {
        pip.open().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [canFloat, pip]);

  async function startShare() {
    setError(null);
    if (!canScreenShare) {
      setError(
        'Screen sharing is not supported in this browser. Use "Upload screenshot" below — your phone camera or photo library works.',
      );
      return;
    }
    try {
      // No displaySurface constraint — the browser picker offers all surfaces
      // (tab, window, entire screen). The captureFrame() function hides the
      // floating panel during capture so it is excluded from the frame
      // regardless of which surface the user picked.
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

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError("Screen share is not ready yet — wait a moment and try again.");
      return;
    }

    // If the floating panel is open AND the user is sharing the whole screen or
    // a window (not a tab), the panel will be visible to the OS compositor and
    // show up in the captured frame. Hide it for one repaint cycle so the
    // grabbed frame shows only the underlying page.
    const pipBody = pip.container?.ownerDocument?.body ?? null;
    const prevVis = pipBody?.style.visibility ?? "";
    if (pipBody) {
      pipBody.style.visibility = "hidden";
      await new Promise<void>((r) => setTimeout(r, 200));
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (pipBody) pipBody.style.visibility = prevVis;
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";

    if (pipBody) pipBody.style.visibility = prevVis;

    setCapture({ base64, mime: "image/png" });
  }

  function submit() {
    if (!capture || !question.trim()) return;
    setSubmittedCapture(capture);
    setSubmittedQuestion(question.trim());
    // Use the click's user-activation token to open the floating panel so the
    // user can switch apps while the answer streams.
    if (canFloat && !pip.isOpen) {
      pip.open().catch(() => {
        // PiP may be unsupported or blocked — fall through silently and the
        // panel stays inline.
      });
    }
  }

  function reset() {
    setSubmittedCapture(null);
    setSubmittedQuestion(null);
  }

  function handleAnswerDone() {
    const root = answerWrapperRef.current;
    const q = submittedQuestion;
    if (!root || !q) return;
    const para = root.querySelector("p");
    const a = (para?.textContent ?? "").trim();
    if (!a || a === "Thinking…" || a === "(empty response)") return;
    setTranscript((prev) => [...prev, { q, a }]);
    fetchQuota();
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
            02 — Ask Tunjuk
          </h2>
          {quota?.enabled ? (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono ${
                quota.used >= quota.limit
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-brand-400/20 bg-brand-400/5 text-brand-300"
              }`}
              title={`${quota.used >= quota.limit ? "Demo allowance used up — top up your Chutes wallet to keep going." : "Free Tunjuk-sponsored prompts available before you need to top up your Chutes wallet."}`}
            >
              {quota.used >= quota.limit
                ? "Demo used — top up chutes.ai/billing"
                : `${quota.limit - quota.used} / ${quota.limit} free prompts`}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-zinc-400">
          Type a question, or speak it. Tunjuk sees the captured frame.
        </p>
      </header>

      {capture ? (
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${capture.mime};base64,${capture.base64}`}
            alt="Captured screen frame"
            className="max-h-48 w-full object-contain bg-[#0a0d18]"
          />
          {stream ? (
            <button
              type="button"
              onClick={captureFrame}
              className="absolute right-2 top-2 rounded-md bg-[#08090f]/80 px-2 py-1 text-[11px] font-semibold text-brand-200 backdrop-blur transition hover:bg-[#08090f]"
              title="Grab a fresh frame from the shared screen"
            >
              📸 Recapture
            </button>
          ) : null}
        </div>
      ) : stream ? (
        <button
          type="button"
          onClick={captureFrame}
          className="w-full rounded-lg border border-brand-400/30 bg-brand-400/10 px-4 py-3 text-sm font-semibold text-brand-200 transition hover:bg-brand-400/15"
        >
          📸 Capture frame from shared screen
        </button>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-sm text-zinc-500">
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
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          rows={3}
        />
        <div className="flex items-center justify-between gap-2">
          <VoiceInput onTranscript={setQuestion} />
          <button
            type="button"
            onClick={submit}
            disabled={!capture || !question.trim()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-[#08090f] shadow-[0_0_24px_-12px_rgba(99, 210, 151,0.6)] transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
          >
            Ask Tunjuk →
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
            className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
          >
            Ask another question
          </button>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">
            Session transcript: {transcript.length}{" "}
            {transcript.length === 1 ? "exchange" : "exchanges"}
          </div>
          <button
            type="button"
            onClick={endSession}
            disabled={summarising || transcript.length === 0}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {summarising ? "Summarising…" : "End session — get summary"}
          </button>
        </div>

        {summaryError ? (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {summaryError}
          </p>
        ) : null}

        {summary ? (
          <div className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
                Session summary
              </h4>
              {summaryModelId ? (
                <span
                  className="rounded-full border border-brand-400/20 bg-[#08090f] px-2 py-0.5 text-[10px] font-mono text-brand-200"
                  title={summaryModelId}
                >
                  {summaryModelId.length > 32
                    ? summaryModelId.slice(0, 30) + "…"
                    : summaryModelId}
                </span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
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
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
            01 — Share your screen
          </h2>
          <p className="text-sm text-zinc-400">
            Pick a window or tab, or upload a screenshot. Tunjuk processes one
            frame at a time — nothing is recorded.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {!stream ? (
            <button
              type="button"
              onClick={startShare}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Start screen share
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={captureFrame}
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-[#08090f] shadow-[0_0_24px_-12px_rgba(99, 210, 151,0.6)] transition hover:bg-brand-400"
              >
                📸 Capture frame
              </button>
              <button
                type="button"
                onClick={stopStream}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                Stop sharing
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-brand-400/40 hover:text-brand-300"
          >
            Upload a screenshot
          </button>
          {canFloat && !isFloating ? (
            <button
              type="button"
              onClick={openFloating}
              className="rounded-lg border border-brand-400/30 bg-brand-400/10 px-4 py-2.5 text-sm font-semibold text-brand-200 transition hover:border-brand-400/50 hover:bg-brand-400/15"
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
          <p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
        >
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full bg-[#0a0d18]"
            />
          ) : capture ? (
            <div className="flex aspect-video w-full items-center justify-center bg-[#0a0d18]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${capture.mime};base64,${capture.base64}`}
                alt="Uploaded screenshot preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 text-center text-sm text-zinc-500">
              <span>Drop a screenshot here, or use the buttons above.</span>
              <span className="text-xs text-zinc-600">
                You can also drag-and-drop a screenshot into this box.
              </span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </section>

      <div
        ref={setInlineContainer}
        className={isFloating ? "hidden" : "space-y-4"}
        aria-hidden={isFloating}
      />

      {isFloating ? (
        <button
          type="button"
          onClick={pip.close}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400/30 bg-brand-400/5 p-6 text-center text-sm text-brand-200 transition hover:border-brand-400/50 hover:bg-brand-400/10"
        >
          <span className="text-2xl">📌</span>
          <span className="font-semibold">
            Panel is floating in a separate window
          </span>
          <span className="text-xs text-brand-300/80">
            Click here to close the floating window and return the panel in
            place.
          </span>
        </button>
      ) : null}

      {askPanelTarget ? createPortal(askPanel, askPanelTarget) : null}
    </div>
  );
}
