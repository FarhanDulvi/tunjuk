"use client";

export function PersistenceBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
      title="No database. Sessions live in a short-lived encrypted cookie. Screen frames stream to Chutes and are never stored by Tunjuk."
    >
      <span aria-hidden>🌐</span>
      <span>No data persisted</span>
    </span>
  );
}
