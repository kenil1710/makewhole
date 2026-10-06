import Link from "next/link";
import { getConfig, getIncident } from "@/lib/reads";
import { DEPLOYMENTS, type Deployment } from "@/lib/config";
import { day } from "@/lib/format";
import type { Incident } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "All incidents" };

export default async function Incidents() {
  const groups: { dep: Deployment; items: Incident[]; error?: boolean }[] = [];
  for (const dep of ["c", "d"] as Deployment[]) {
    try {
      const n = (await getConfig(dep)).incidents;
      const items = await Promise.all(Array.from({ length: n }, (_, i) => getIncident(dep, i + 1)));
      groups.push({ dep, items });
    } catch { groups.push({ dep, items: [], error: true }); }
  }
  const now = Date.now() / 1000;
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h1>All incidents</h1>
      <p className="lede" style={{ marginTop: 14 }}>The canonical deployment holds the real incident. The demo deployment runs the same contract with windows of minutes, so settlement, pro-rata, appeals and expiry can be seen end to end.</p>
      {groups.map((g) => (
        <section key={g.dep} className="section">
          <h2>{DEPLOYMENTS[g.dep].label}</h2>
          <p className="section-note">{DEPLOYMENTS[g.dep].blurb}</p>
          {g.error ? <p className="notice amber">Couldn&rsquo;t be read just now.</p> : g.items.length === 0 ? <p className="muted">No incidents yet.</p> : (
            <table className="ledger stack">
              <thead><tr><th>#</th><th>Incident</th><th>Claims</th><th>Stage</th><th>Created</th></tr></thead>
              <tbody>
                {g.items.map((i) => (
                  <tr key={i.incident_id}>
                    <td data-label="#">{i.incident_id}</td>
                    <td data-label="Incident"><Link href={`/incident/${g.dep}-${i.incident_id}`}>{i.title}</Link></td>
                    <td data-label="Claims" className="num">{i.claims}</td>
                    <td data-label="Stage">{i.closed ? "Closed" : now < i.claim_end ? "Claims open" : now < i.appeal_end ? (i.settled ? "Settled, appeals open" : "Appeals only") : "Ready to close"}</td>
                    <td data-label="Created">{day(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
