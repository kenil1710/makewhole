import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { V2_CONTRACTS, REPO, gl2addr } from "@/lib/v2";
import deployments from "@/data/deployments.json";

export const metadata: Metadata = { title: "Verify the deployed source" };
export const revalidate = 300;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function studio(method: string, params: unknown[]) {
  const r = await fetch("https://studio-dev.genlayer.com/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), next: { revalidate: 300 } });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

export default async function Verify() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v1 = (deployments as any).contracts as Record<string, { address: string; commit: string; file: string; sha256: string }>;
  const rows = [...Object.entries(V2_CONTRACTS).map(([n, r]) => ({ set: "v2", n, ...r })), ...Object.entries(v1).map(([n, r]) => ({ set: "v1 (BASE)", n, ...r }))];
  const out = await Promise.all(rows.map(async (r) => {
    try {
      const chain = Buffer.from(String(await studio("gen_getContractCode", [r.address])), "base64");
      const raw = await fetch(`https://raw.githubusercontent.com/kenil1710/makewhole/${r.commit}/${r.file}`, { next: { revalidate: 3600 } });
      const file = Buffer.from(await raw.arrayBuffer());
      return { ...r, bytes: chain.length, chainSha: sha(chain), fileSha: sha(file), same: raw.ok && chain.equals(file) };
    } catch (e) { return { ...r, bytes: 0, chainSha: "", fileSha: "", same: false, err: String((e as Error).message).slice(0, 100) }; }
  }));
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h1 className="serif">Verify the deployed source</h1>
      <p className="lede">This page reads each contract&rsquo;s code back from Studio Dev (<code>gen_getContractCode</code>) and the file at its deploy commit from GitHub, now, and compares them byte for byte. The same check runs offline as <a href={`${REPO}/blob/main/tools/verify_source.mjs`}>tools/verify_source.mjs</a>.</p>
      <div className="scroll-x" style={{ marginTop: 20 }}>
        <table className="ledger">
          <thead><tr><th>Set</th><th>Contract</th><th>Address</th><th>File at commit</th><th className="r">Bytes</th><th>sha256 on chain</th><th>Result</th></tr></thead>
          <tbody>
            {out.map((r) => (
              <tr key={r.address}>
                <td>{r.set}</td><td>{r.n}</td>
                <td><a className="mono" href={gl2addr(r.address)} target="_blank" rel="noreferrer">{r.address.slice(0, 10)}…</a></td>
                <td><a className="mono" href={`${REPO}/blob/${r.commit}/${r.file}`} target="_blank" rel="noreferrer">{r.file}@{r.commit.slice(0, 7)}</a></td>
                <td className="r num">{r.bytes.toLocaleString("en-US")}</td>
                <td className="mono small">{r.chainSha.slice(0, 20)}…</td>
                <td>{r.same ? <span className="tag green">byte-identical</span> : <span className="tag red">{"err" in r ? "unreadable" : "differs"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
