"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const dl = (n: number) => ({ ["--dl"]: n } as CSSProperties);

/* ----------------------------- SVG scenes ----------------------------- */

function SceneSignIn() {
  return (
    <svg viewBox="0 0 400 400" fill="none">
      {/* browser node (left) */}
      <rect className="a-scale" x="40" y="150" width="110" height="90" rx="12" fill="#0f1512" stroke="#2b3a33" strokeWidth="1.5" />
      <rect className="a-fade hiw-d1" x="40" y="150" width="110" height="20" rx="12" fill="#11201a" />
      <circle className="a-scale hiw-d2" cx="56" cy="160" r="3" fill="#3fbf7e" />
      <circle className="a-scale hiw-d2" cx="66" cy="160" r="3" fill="#1f9d63" />
      <rect className="a-fade hiw-d3" x="58" y="190" width="74" height="6" rx="3" fill="#2b3a33" />
      <rect className="a-fade hiw-d3" x="58" y="204" width="54" height="6" rx="3" fill="#22302a" />
      {/* chutes node (right) */}
      <circle className="a-scale hiw-d2" cx="320" cy="195" r="40" fill="#0f1512" stroke="#63d297" strokeWidth="2" />
      <path className="a-draw hiw-d4" d="M305 200c6-14 24-14 30 0" stroke="#63d297" strokeWidth="2.5" strokeLinecap="round" style={dl(60)} />
      <circle className="a-scale hiw-d5 l-pulse" cx="320" cy="183" r="4" fill="#63d297" />
      {/* handshake line */}
      <line className="a-draw hiw-d3" x1="150" y1="195" x2="280" y2="195" stroke="#3fbf7e" strokeWidth="1.5" style={dl(140)} />
      <circle className="l-pulse" cx="215" cy="195" r="4" fill="#63d297" />
      {/* lock in the middle */}
      <rect className="a-scale hiw-d4" x="196" y="156" width="38" height="30" rx="6" fill="#11201a" stroke="#63d297" strokeWidth="1.5" />
      <path className="a-draw hiw-d5" d="M203 156v-8a12 12 0 0124 0v8" stroke="#63d297" strokeWidth="1.5" fill="none" style={dl(50)} />
      <circle className="a-scale hiw-d6" cx="215" cy="170" r="3.5" fill="#63d297" />
      {/* success check */}
      <circle className="a-scale hiw-d7" cx="215" cy="270" r="20" fill="#11201a" stroke="#63d297" strokeWidth="1.5" />
      <path className="a-draw hiw-d8" d="M206 270l6 7 12-14" stroke="#63d297" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={dl(40)} />
      <text className="a-fade hiw-d9" x="200" y="330" textAnchor="middle" fill="#6f8079" fontSize="12" fontFamily="var(--font-mono)">scope: chutes:invoke</text>
    </svg>
  );
}

function SceneShare() {
  return (
    <svg viewBox="0 0 400 400" fill="none">
      {/* main window */}
      <rect className="a-scale" x="80" y="70" width="240" height="170" rx="12" fill="#0f1512" stroke="#2b3a33" strokeWidth="1.5" />
      <rect className="a-fade hiw-d1" x="80" y="70" width="240" height="24" rx="12" fill="#11201a" />
      <circle className="a-scale hiw-d2" cx="98" cy="82" r="3.5" fill="#3fbf7e" />
      <circle className="a-scale hiw-d2" cx="110" cy="82" r="3.5" fill="#1f9d63" />
      {/* share glyph (broadcast) */}
      <circle className="a-scale hiw-d4" cx="200" cy="160" r="14" fill="none" stroke="#63d297" strokeWidth="2" />
      <path className="a-draw hiw-d5" d="M200 146v-18" stroke="#63d297" strokeWidth="2.5" strokeLinecap="round" style={dl(24)} />
      <path className="a-draw hiw-d5" d="M192 134l8-8 8 8" stroke="#63d297" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={dl(28)} />
      <path className="l-flow" d="M168 188a45 45 0 0164 0" stroke="#3fbf7e" strokeWidth="2" fill="none" opacity="0.7" />
      <path className="l-flow" d="M154 202a66 66 0 0192 0" stroke="#1f9d63" strokeWidth="2" fill="none" opacity="0.5" />
      {/* source chips: tab / window / screenshot */}
      <g className="a-in hiw-d6">
        <rect x="78" y="280" width="74" height="50" rx="8" fill="#0f1512" stroke="#2b3a33" strokeWidth="1.2" />
        <rect x="90" y="294" width="50" height="6" rx="3" fill="#3fbf7e" opacity="0.7" />
        <rect x="90" y="306" width="34" height="5" rx="2.5" fill="#2b3a33" />
        <text x="115" y="345" textAnchor="middle" fill="#6f8079" fontSize="9" fontFamily="var(--font-sans)">Tab</text>
      </g>
      <g className="a-in hiw-d7">
        <rect x="163" y="280" width="74" height="50" rx="8" fill="#0f1512" stroke="#63d297" strokeWidth="1.4" />
        <rect x="173" y="290" width="54" height="30" rx="4" fill="#11201a" />
        <text x="200" y="345" textAnchor="middle" fill="#63d297" fontSize="9" fontFamily="var(--font-sans)">Window</text>
      </g>
      <g className="a-in hiw-d8">
        <rect x="248" y="280" width="74" height="50" rx="8" fill="#0f1512" stroke="#2b3a33" strokeWidth="1.2" />
        <path d="M262 312l10-12 8 8 6-6 8 10" stroke="#3fbf7e" strokeWidth="1.5" fill="none" opacity="0.7" />
        <circle cx="270" cy="294" r="3" fill="#3fbf7e" opacity="0.7" />
        <text x="285" y="345" textAnchor="middle" fill="#6f8079" fontSize="9" fontFamily="var(--font-sans)">Image</text>
      </g>
    </svg>
  );
}

function SceneAsk() {
  const bars = [62, 40, 78, 30, 88, 46, 70, 34, 58];
  return (
    <svg viewBox="0 0 400 400" fill="none">
      {/* mic */}
      <rect className="a-scale" x="182" y="70" width="36" height="64" rx="18" fill="#11201a" stroke="#63d297" strokeWidth="2" />
      <path className="a-draw hiw-d2" d="M166 116a34 34 0 0068 0" stroke="#63d297" strokeWidth="2" fill="none" style={dl(120)} />
      <line className="a-draw hiw-d3" x1="200" y1="150" x2="200" y2="172" stroke="#63d297" strokeWidth="2" style={dl(24)} />
      <line className="a-draw hiw-d3" x1="184" y1="172" x2="216" y2="172" stroke="#63d297" strokeWidth="2" strokeLinecap="round" style={dl(34)} />
      {/* waveform */}
      <g>
        {bars.map((h, i) => (
          <rect
            key={i}
            className="l-bar"
            x={120 + i * 18}
            y={232 - h / 2}
            width="7"
            height={h}
            rx="3.5"
            fill={i % 2 ? "#3fbf7e" : "#63d297"}
            opacity={0.55 + (i % 3) * 0.15}
            style={{ animationDelay: `${i * 0.09}s` }}
          />
        ))}
      </g>
      {/* transcript */}
      <g className="a-in hiw-d6">
        <rect x="100" y="288" width="200" height="64" rx="10" fill="#0f1512" stroke="#2b3a33" strokeWidth="1.2" />
      </g>
      <rect className="a-in hiw-d7" x="116" y="304" width="120" height="7" rx="3.5" fill="#3fbf7e" opacity="0.8" />
      <rect className="a-in hiw-d8" x="116" y="318" width="168" height="6" rx="3" fill="#2b3a33" />
      <rect className="a-in hiw-d9" x="116" y="330" width="96" height="6" rx="3" fill="#22302a" />
      <text className="a-fade hiw-d6" x="290" y="280" textAnchor="end" fill="#6f8079" fontSize="11" fontFamily="var(--font-mono)">on-device STT</text>
    </svg>
  );
}

function SceneAnswer() {
  return (
    <svg viewBox="0 0 400 400" fill="none">
      {/* model node with scan ring */}
      <circle className="l-scan" cx="100" cy="150" r="46" stroke="#1f9d63" strokeWidth="1" strokeDasharray="6 10" opacity="0.5" fill="none" />
      <circle className="a-scale" cx="100" cy="150" r="34" fill="#0f1512" stroke="#63d297" strokeWidth="2" />
      {/* eye / vision glyph */}
      <path className="a-draw hiw-d3" d="M80 150c8-12 32-12 40 0-8 12-32 12-40 0z" stroke="#63d297" strokeWidth="2" fill="none" style={dl(90)} />
      <circle className="a-scale hiw-d4 l-pulse" cx="100" cy="150" r="6" fill="#63d297" />
      {/* streaming data lines into the card */}
      <line className="l-flow" x1="138" y1="140" x2="220" y2="120" stroke="#3fbf7e" strokeWidth="2" opacity="0.8" />
      <line className="l-flow" x1="138" y1="155" x2="220" y2="160" stroke="#63d297" strokeWidth="2" />
      <line className="l-flow" x1="138" y1="170" x2="220" y2="200" stroke="#1f9d63" strokeWidth="2" opacity="0.7" />
      {/* answer card */}
      <rect className="a-scale hiw-d3" x="222" y="92" width="138" height="150" rx="12" fill="#0f1512" stroke="#2b3a33" strokeWidth="1.5" />
      <rect className="a-in hiw-d5" x="238" y="112" width="80" height="8" rx="4" fill="#63d297" opacity="0.85" />
      <rect className="a-in hiw-d6" x="238" y="132" width="106" height="6" rx="3" fill="#3a4a43" />
      <rect className="a-in hiw-d7" x="238" y="146" width="92" height="6" rx="3" fill="#2b3a33" />
      <rect className="a-in hiw-d8" x="238" y="160" width="100" height="6" rx="3" fill="#2b3a33" />
      <rect className="a-in hiw-d9" x="238" y="174" width="72" height="6" rx="3" fill="#22302a" />
      {/* TEE badge */}
      <g className="l-float">
        <rect className="a-scale hiw-d9" x="232" y="198" width="118" height="30" rx="8" fill="#11201a" stroke="#63d297" strokeWidth="1.3" />
        <path className="a-draw hiw-d10" d="M246 213l4 5 7-9" stroke="#63d297" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={dl(30)} />
        <text className="a-fade hiw-d10" x="305" y="217" textAnchor="middle" fill="#63d297" fontSize="10" fontWeight="600" fontFamily="var(--font-sans)">Confidential · TDX</text>
      </g>
      <text className="a-fade hiw-d9" x="100" y="225" textAnchor="middle" fill="#6f8079" fontSize="11" fontFamily="var(--font-mono)">vision model</text>
    </svg>
  );
}

/* ------------------------------ stepper ------------------------------- */

const STEPS = [
  {
    n: "01",
    label: "Sign in with Chutes",
    body: "One PKCE OAuth handshake, scoped to chutes:invoke. Tunjuk never sees a password and holds zero credits — every call is billed to your own Chutes account.",
    stat: "OAuth",
    statLabel: "PKCE + state",
    Scene: SceneSignIn,
  },
  {
    n: "02",
    label: "Share a screen",
    body: "Pick a browser tab, a whole window, or drop a screenshot. Captures live only in your browser's memory and are sent exactly once per question.",
    stat: "1 frame",
    statLabel: "sent per question",
    Scene: SceneShare,
  },
  {
    n: "03",
    label: "Ask out loud",
    body: "The Web Speech API transcribes your question on-device — nothing leaves the browser until you ask. Prefer typing? That works too.",
    stat: "On-device",
    statLabel: "speech-to-text",
    Scene: SceneAsk,
  },
  {
    n: "04",
    label: "Get an answer",
    body: "A confidential-compute vision model reads the frame and streams the answer back — pinned to an Intel TDX enclave the operator can't read into.",
    stat: "TEE",
    statLabel: "Intel TDX enclave",
    Scene: SceneAnswer,
  },
];

export function HowItWorks() {
  const [cur, setCur] = useState(0);
  const reduced = useReducedMotion();
  const pausedRef = useRef(false);

  const go = useCallback((i: number) => setCur((i + STEPS.length) % STEPS.length), []);

  // Gentle autoplay; pauses on hover and when reduced motion is requested.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) setCur((c) => (c + 1) % STEPS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [reduced]);

  const step = STEPS[cur];

  return (
    <div>
      <h2 className="mb-2 text-3xl font-bold tracking-tight text-white">How it works</h2>
      <p className="mb-8 text-zinc-500">Four steps from a shared screen to a spoken answer.</p>

      <div
        className="grid gap-4 lg:grid-cols-[1fr_1.05fr]"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        {/* SVG scene panel */}
        <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-white/10 bg-black sm:min-h-[400px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,210,151,0.08),transparent_70%)]" />
          {STEPS.map((s, i) => (
            <div key={s.n} className={`hiw-scene ${i === cur ? "is-active" : ""}`}>
              <s.Scene />
            </div>
          ))}
        </div>

        {/* content panel */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#0d0f12] p-7 sm:p-9">
          <div className="mb-6 flex items-center justify-between">
            <span className="font-mono text-xs text-brand-400">
              {step.n} <span className="text-zinc-600">/ 04</span>
            </span>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <button
                    key={s.n}
                    onClick={() => go(i)}
                    aria-label={`Go to step ${s.n}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === cur ? "w-6 bg-brand-400" : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => go(cur - 1)}
                  aria-label="Previous step"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition hover:border-white/25 hover:text-white"
                >
                  ←
                </button>
                <button
                  onClick={() => go(cur + 1)}
                  aria-label="Next step"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition hover:border-white/25 hover:text-white"
                >
                  →
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.n}
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -14 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="mb-4 text-2xl font-semibold text-white">{step.label}</h3>
                <p className="max-w-md text-sm leading-relaxed text-zinc-400">{step.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="text-3xl font-light text-brand-300">{step.stat}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
              {step.statLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
