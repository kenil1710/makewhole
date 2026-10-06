"use client";
import { useEffect } from "react";

/** Shown when GenLayer can't be read for a page that has never rendered before. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.warn("ledger read failed", error.digest ?? ""); }, [error]);
  return (
    <div className="wrap" style={{ padding: "64px 16px" }}>
      <h1>The ledger couldn&rsquo;t be read just now</h1>
      <p className="lede" style={{ marginTop: 14 }}>MakeWhole reads every number live from GenLayer Studio Dev, which limits how many requests it answers per minute. Nothing is wrong with the record itself.</p>
      <p style={{ marginTop: 20 }}><button className="btn" onClick={reset}>Try again</button></p>
    </div>
  );
}
