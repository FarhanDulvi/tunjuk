"use client";

import type { Annotation } from "@/lib/chutes";

interface Props {
  imageBase64: string;
  mimeType: string;
  annotations: Annotation[];
}

// Renders the captured screenshot with cyan bounding boxes around the regions
// the model said the answer is pointing at. Returns null when there are no
// annotations so the answer flow is unaffected when the model returned
// nothing or low-confidence coords.
export function AnnotatedScreenshot({
  imageBase64,
  mimeType,
  annotations,
}: Props) {
  if (!annotations.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-400/30 bg-[#0a0d18] shadow-[0_0_30px_-12px_rgba(99, 210, 151,0.35)]">
      <div className="flex items-center justify-between border-b border-brand-400/20 bg-brand-400/5 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          Where to look
        </span>
        <span className="text-[10px] font-mono text-brand-300/70">
          {annotations.length} {annotations.length === 1 ? "region" : "regions"}
        </span>
      </div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:${mimeType};base64,${imageBase64}`}
          alt="Annotated screenshot"
          className="block w-full"
        />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {annotations.map((a, i) => (
            <g key={i}>
              <rect
                x={a.x * 100}
                y={a.y * 100}
                width={a.w * 100}
                height={a.h * 100}
                fill="rgba(99, 210, 151, 0.10)"
                stroke="#63d297"
                strokeWidth="2"
                strokeDasharray="6 3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>
        {annotations.map((a, i) => {
          const labelOnTop = a.y > 0.08;
          const top = labelOnTop ? `${a.y * 100}%` : `${(a.y + a.h) * 100}%`;
          const transform = labelOnTop
            ? "translate(4px, -100%)"
            : "translate(4px, 4px)";
          return (
            <span
              key={i}
              className="pointer-events-none absolute rounded-md bg-brand-400 px-1.5 py-0.5 text-[10px] font-semibold text-[#08090f] shadow-[0_4px_12px_-2px_rgba(99, 210, 151,0.5)]"
              style={{
                left: `${a.x * 100}%`,
                top,
                transform,
                maxWidth: "55%",
              }}
            >
              {i + 1}. {a.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
