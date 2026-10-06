"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem("mw-theme"); } catch { /* private mode */ }
    const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "dark" : "light");
  }, []);
  if (!theme) return <span style={{ width: 36, height: 36, display: "inline-block" }} />;
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="copy" style={{ width: 36, height: 36 }} aria-label={`Switch to ${next} theme`}
      onClick={() => { document.documentElement.dataset.theme = next; try { localStorage.setItem("mw-theme", next); } catch { /* */ } setTheme(next); }}>
      {theme === "dark"
        ? <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5M4 4l1.7 1.7M14.3 14.3L16 16M4 16l1.7-1.7M14.3 5.7L16 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        : <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M16 12.5A6.5 6.5 0 017.5 4a6.5 6.5 0 108.5 8.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>}
    </button>
  );
}
