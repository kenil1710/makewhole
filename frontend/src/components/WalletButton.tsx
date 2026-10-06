"use client";
import { useWallet } from "./WalletProvider";
import { short } from "@/lib/format";

export function WalletButton() {
  const w = useWallet();
  if (!w.hasWallet) return <a className="btn ghost sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get a wallet</a>;
  if (!w.account) return <button className="btn sm" onClick={w.connect} disabled={w.connecting}>{w.connecting ? "Connecting…" : "Connect wallet"}</button>;
  if (!w.onRightNetwork) return <button className="btn sm" style={{ background: "var(--amber)", borderColor: "var(--amber)" }} onClick={w.switchNetwork}>Switch to Studio Dev</button>;
  return (
    <span className="mono small" style={{ display: "inline-flex", alignItems: "center", gap: 8 }} title={w.account}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 8, background: "var(--green)" }} />
      <span className="sr-only">Connected as</span>{short(w.account, 4, 4)}
    </span>
  );
}

/** Inline gate for a form: says exactly what's missing before a write can be sent. */
export function WalletGate({ children }: { children: React.ReactNode }) {
  const w = useWallet();
  if (!w.hasWallet) return <p className="notice amber">To send this you need a browser wallet such as MetaMask. Everything on this page stays readable without one.</p>;
  if (!w.account) return <div className="notice"><p style={{ margin: "0 0 10px" }}>Connect a wallet to send this to GenLayer Studio Dev. Fees are paid in test GEN.</p><button className="btn sm" onClick={w.connect}>Connect wallet</button>{w.error && <p className="small" style={{ color: "var(--red)" }}>{w.error}</p>}</div>;
  if (!w.onRightNetwork) return <div className="notice amber"><p style={{ margin: "0 0 10px" }}>Your wallet is on another network. MakeWhole runs on GenLayer Studio Dev (chain 61997).</p><button className="btn sm" onClick={w.switchNetwork}>Switch network</button></div>;
  return <>{children}</>;
}
