"use client";
import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      aria-label={`${label}: ${value}`}
      title={done ? "Copied" : label}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* blocked */ }
      }}
    >
      {done ? (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3 11V3.5A1.5 1.5 0 014.5 2H10" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      )}
      <span className="sr-only" aria-live="polite">{done ? "Copied" : ""}</span>
    </button>
  );
}
