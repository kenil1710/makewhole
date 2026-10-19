import Link from "next/link";
import type { Metadata } from "next";
import { incidents2, DEP_LABEL, gen, type Dep2, type Incident2 } from "@/lib/v2";
import { Phase } from "@/components/v2/Bits";

export const metadata: Metadata = { title: "Incident explorer" };
export const revalidate = 60;

export default async function Explorer() {
  const sets: { dep: Dep2; items: Incident2[]; failed: boolean }[] = [];
  for (const dep of ["c", "d"] as Dep2[]) {
    try { sets.push({ dep, items: await incidents2(dep), failed: false }); } catch { sets.push({ dep, items: [], failed: true }); }
  }
  const now = Math.floor(Date.now() / 1000);
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h1 className="serif">Incident explorer</h1>
      <p className="lede">Canonical incidents are real: their events are real liquidations, filed by the keeper. Demo incidents use the same contract code with windows of minutes, to show every path end to end.</p>
      {sets.map(({ dep, items, failed }) => (
        <section className="section" key={dep}>
          <h2 className="serif">{DEP_LABEL[dep]}</h2>
          {failed && <p className="notice amber">Could not be read just now; reload in a minute.</p>}
          <div className="scroll-x">
            <table className="ledger">
              <thead><tr><th>#</th><th>Incident</th><th>Protocol</th><th>Chain</th><th className="r">Events</th><th className="r">Eligible</th><th className="r">Accounts</th><th className="r">Owed GEN</th><th className="r">Pool GEN</th><th className="r">Paid GEN</th><th>Phase</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.incident_id}>
                    <td className="num">{i.incident_id}</td>
                    <td><Link href={`/explorer/${dep}-${i.incident_id}`}>{i.title}</Link></td>
                    <td>{i.protocol}</td>
                    <td>{i.chain}</td>
                    <td className="r num">{i.filings}</td>
                    <td className="r num">{i.eligible}</td>
                    <td className="r num">{i.accounts}</td>
                    <td className="r num">{gen(i.owed_gen_total_wei, 4)}</td>
                    <td className="r num">{gen(i.pool_wei, 4)}</td>
                    <td className="r num">{gen(i.paid_wei, 4)}</td>
                    <td><Phase i={i} now={now} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
