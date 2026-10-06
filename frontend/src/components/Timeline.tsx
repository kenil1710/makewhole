import { day, until } from "@/lib/format";
import { ethblock } from "@/lib/config";

/** The Ethereum blocks the terms cover, with each covered liquidation as a tick. */
export function BlockRange({ from, to, blocks }: { from: number; to: number; blocks: number[] }) {
  const span = Math.max(1, to - from);
  const counts = new Map<number, number>();
  for (const b of blocks) counts.set(b, (counts.get(b) ?? 0) + 1);
  return (
    <figure className="range" aria-label={`Ethereum blocks ${from} to ${to}; ${blocks.length} liquidations in blocks ${[...counts.keys()].sort().join(", ")}`}>
      <div className="range-track">
        {[...counts.entries()].map(([b, n]) => (
          <span key={b} className="range-tick" style={{ left: `${((b - from) / span) * 100}%`, height: `${Math.min(100, 30 + n * 6)}%` }} title={`block ${b}: ${n} liquidation${n > 1 ? "s" : ""}`} />
        ))}
      </div>
      <figcaption className="range-cap">
        <a className="num" href={ethblock(from)} target="_blank" rel="noreferrer">{from.toLocaleString("en-US")}</a>
        <span className="muted small">{blocks.length} liquidations, all in the first {Math.max(...blocks, from) - from + 1} blocks · fix live in {(to + 1).toLocaleString("en-US")}</span>
        <a className="num" href={ethblock(to)} target="_blank" rel="noreferrer">{to.toLocaleString("en-US")}</a>
      </figcaption>
      {counts.size > 0 && (() => {
        const first = from, last = Math.max(...counts.keys());
        const n = Math.min(12, last - first + 3);
        const peak = Math.max(...counts.values());
        return (
          <div className="inset" aria-hidden="true">
            <p className="small muted" style={{ margin: "18px 0 8px" }}>Liquidations per block, first {n} blocks of the range</p>
            <div className="inset-bars">
              {Array.from({ length: n }, (_, i) => first + i).map((b) => {
                const c = counts.get(b) ?? 0;
                return (
                  <div key={b} className="inset-col" title={`block ${b}: ${c}`}>
                    <span className="inset-n num">{c || ""}</span>
                    <span className="inset-bar" style={{ height: `${(c / peak) * 100}%` }} />
                    <span className="inset-b num">…{String(b).slice(-3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </figure>
  );
}

/** Created -> claim deadline -> appeal deadline, with where we are now. */
export function Deadlines({ created, claimEnd, appealEnd, closed }: { created: number; claimEnd: number; appealEnd: number; closed: boolean }) {
  const now = Date.now() / 1000;
  const pos = Math.max(0, Math.min(1, (now - created) / (appealEnd - created)));
  const cpos = (claimEnd - created) / (appealEnd - created);
  const phase = closed ? "Closed" : now < claimEnd ? "Claims open" : now < appealEnd ? "Appeals only" : "Ready to close";
  return (
    <figure className="deadlines">
      <div className="dl-track" role="img" aria-label={`${phase}. Claims close ${day(claimEnd)}, appeals close ${day(appealEnd)}.`}>
        <span className="dl-fill" style={{ width: `${pos * 100}%` }} />
        <span className="dl-pin" style={{ left: `${cpos * 100}%` }} />
      </div>
      <figcaption className="dl-cap">
        <span><b>Filed</b><br /><span className="small muted">{day(created)}</span></span>
        <span style={{ textAlign: "center" }}><b>Claims close</b><br /><span className="small muted">{day(claimEnd)} · {until(claimEnd)}</span></span>
        <span style={{ textAlign: "right" }}><b>Appeals close</b><br /><span className="small muted">{day(appealEnd)} · {until(appealEnd)}</span></span>
      </figcaption>
    </figure>
  );
}
