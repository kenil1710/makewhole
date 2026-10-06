import Link from "next/link";
import { catalog, type Entry } from "@/lib/catalog";
import { day } from "@/lib/format";
import { TryIt } from "@/components/TryIt";

export const revalidate = 60;
export const metadata = { title: "Incidents" };

const GROUPS: { key: Entry["group"]; title: string; note: string }[] = [
  { key: "canonical", title: "The real incident", note: "Canonical deployment: real 30-day claim and 14-day appeal windows, all 49 real liquidations filed." },
  { key: "scenario", title: "Demo scenarios", note: "The same contract on the demo deployment with windows of minutes, so every path can be seen end to end." },
  { key: "copy", title: "Copies made with Try it yourself", note: "Each is a copy of the Aave incident someone created to run the flow themselves." },
  { key: "test", title: "Test runs", note: "Internal runs (for example the stability check). Kept for the record, hidden from pickers." },
];

function stage(e: Entry) {
  const now = Date.now() / 1000, i = e.inc;
  return i.closed ? "Closed" : now < i.claim_end ? "Claims open" : now < i.appeal_end ? (i.settled ? "Settled, appeals open" : "Appeals only") : "Ready to close";
}

export default async function Incidents() {
  const { entries, failed } = await catalog();
  if (!entries.length) throw new Error("no incidents readable");
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h1>Incidents</h1>
      <p className="lede" style={{ marginTop: 14 }}>Each incident is a frozen set of refund rules with its own pool. The real one comes first.</p>
      {failed.length > 0 && <p className="notice amber" style={{ marginTop: 16 }}>Some incidents couldn&rsquo;t be read just now; reload in a minute.</p>}
      {GROUPS.map((g) => {
        const rows = entries.filter((e) => e.group === g.key);
        if (!rows.length && g.key !== "copy") return null;
        return (
          <section key={g.key} className="section">
            <h2>{g.title}</h2>
            <p className="section-note">{g.note}</p>
            {rows.length === 0 ? <TryIt compact /> : (
              <table className="ledger stack">
                <thead><tr><th>Incident</th><th>Claims</th><th>Stage</th><th>Created</th></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.ref}>
                      <td data-label="Incident"><Link prefetch={false} href={`/incident/${e.ref}`}>{e.name}</Link><div className="small muted mono">{e.ref}</div></td>
                      <td data-label="Claims" className="num">{e.inc.claims}</td>
                      <td data-label="Stage">{stage(e)}</td>
                      <td data-label="Created">{day(e.inc.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
