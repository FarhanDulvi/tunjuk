"use client";

export function PersistenceBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300"
      title="No database. Sessions live in a short-lived encrypted cookie. Screen frames stream to Chutes and are never stored by Tunjuk."
    >
      <span aria-hidden>🌐</span>
      <span>No data persisted</span>
    </span>
  );
}
