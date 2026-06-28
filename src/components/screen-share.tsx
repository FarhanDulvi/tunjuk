"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceInput } from "@/components/voice-input";
import { AnswerStream } from "@/components/answer-stream";

interface Capture {
  base64: string;
  mime: string;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
            <AnswerStream
              question={submittedQuestion}
              imageBase64={submittedCapture.base64}
              mimeType={submittedCapture.mime}
            />
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              Ask another question
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
