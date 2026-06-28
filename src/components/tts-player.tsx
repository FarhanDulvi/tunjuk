"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  autoPlay?: boolean;
}

function supportsSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function TtsPlayer({ text, autoPlay = false }: Props) {
  const [supported] = useState(() => supportsSpeechSynthesis());
  const [playing, setPlaying] = useState(false);
  const autoPlayedRef = useRef(false);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }, [supported]);

  const play = useCallback(() => {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [supported, text]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (autoPlay && text && supported && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      play();
    }
  }, [autoPlay, text, supported, play]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={playing ? stop : play}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
      aria-label={playing ? "Stop speaking" : "Speak answer"}
    >
      <span aria-hidden>{playing ? "⏹" : "▶"}</span>
      <span>{playing ? "Stop" : "Speak"}</span>
    </button>
  );
}
