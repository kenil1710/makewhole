import Link from "next/link";
import { asset, gen, short, srcAddr, srcTx, srcBlock, gl2tx, gl2addr } from "@/lib/v2";

export function Gen({ wei, dp = 6 }: { wei: string | bigint; dp?: number }) {
  return <span className="num">{gen(wei, dp)}&nbsp;<small className="muted">GEN</small></span>;
}
export function Eth({ wei, dp = 6, unit = "ETH" }: { wei: string | bigint; dp?: number; unit?: string }) {
  return <span className="num">{gen(wei, dp)}&nbsp;<small className="muted">{unit}</small></span>;
}
export function Addr({ a, chain }: { a: string; chain?: number }) {
  if (!a) return <span className="muted">—</span>;
  return chain ? <a className="mono" href={srcAddr(chain, a)} target="_blank" rel="noreferrer" title={a}>{short(a)}</a>
    : <a className="mono" href={gl2addr(a)} target="_blank" rel="noreferrer" title={a}>{short(a)}</a>;
}
export function SrcTx({ chain, h, li }: { chain: number; h: string; li?: number }) {
  return <a className="mono" href={srcTx(chain, h)} target="_blank" rel="noreferrer" title={h}>{h.slice(0, 10)}…{li !== undefined ? `#${li}` : ""}</a>;
}
export function GlTx({ h }: { h: string }) {
  return <a className="mono" href={gl2tx(h)} target="_blank" rel="noreferrer" title={h}>{h.slice(0, 10)}…</a>;
}
export function Block({ chain, b }: { chain: number; b: number }) {
  return <a className="mono" href={srcBlock(chain, b)} target="_blank" rel="noreferrer">{b.toLocaleString("en-US")}</a>;
}
export function Asset({ a }: { a: string }) {
  return <span title={a}>{asset(a)}</span>;
}
const TONE: Record<string, string> = { ELIGIBLE: "green", PAID: "green", MATCH: "green", FILED: "green", OK: "green",
  NOT_ELIGIBLE: "red", DIFF: "amber", NOT_IN_LIST: "amber", CLOSED: "", ELIGIBLE_UNPAID: "amber", NO_INCIDENT: "", UNAVAILABLE: "red",
  REFUSED: "red", RETRY: "amber", SUBMITTED: "amber", QUEUED: "" };
export function Tag({ t }: { t: string }) {
  return <span className={`tag ${TONE[t] ?? ""}`}>{t.replaceAll("_", " ")}</span>;
}
export function Phase({ i, now }: { i: { claim_deadline: number; claim_end: number; closed: boolean }; now: number }) {
  if (i.closed) return <Tag t="CLOSED" />;
  if (now < i.claim_deadline) return <span className="tag">Filing open until {new Date(i.claim_deadline * 1000).toUTCString().slice(5, 22)} UTC</span>;
  if (now < i.claim_end) return <span className="tag green">Payouts open until {new Date(i.claim_end * 1000).toUTCString().slice(5, 22)} UTC</span>;
  return <span className="tag amber">Claim window over: close returns the rest</span>;
}
export function IncLink({ dep, id, children }: { dep: string; id: number; children: React.ReactNode }) {
  return <Link href={`/explorer/${dep}-${id}`}>{children}</Link>;
}
