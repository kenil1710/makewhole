import { getConfig, getIncident } from "@/lib/reads";
import { DEPLOYMENTS, type Deployment } from "@/lib/config";
import { FileClaim, type IncidentOption } from "@/components/FileClaim";

export const revalidate = 60;
export const metadata = { title: "File a claim" };

export default async function FilePage({ searchParams }: { searchParams: Promise<{ incident?: string; tx?: string }> }) {
  const sp = await searchParams;
  const options: IncidentOption[] = [];
  for (const dep of ["c", "d"] as Deployment[]) {
    try {
      const n = (await getConfig(dep)).incidents;
      const ids = Array.from({ length: n }, (_, i) => n - i).slice(0, 12);
      for (const id of ids) {
        const inc = await getIncident(dep, id);
        options.push({ ref: `${dep}-${id}`, dep, address: DEPLOYMENTS[dep].address, label: `${DEPLOYMENTS[dep].label} #${id}: ${inc.title}`, inc });
      }
    } catch { /* deployment unreadable right now */ }
  }
  return (
    <div className="wrap" style={{ paddingTop: 40, maxWidth: 880 }}>
      <h1>File a claim</h1>
      <p className="lede" style={{ marginTop: 14 }}>Paste the Ethereum transaction that liquidated the position. You don&rsquo;t need to be the borrower: the refund is always owed to the account in the log.</p>
      {options.length === 0
        ? <p className="notice amber" style={{ marginTop: 24 }}>Incidents couldn&rsquo;t be read from GenLayer just now. Reload in a minute.</p>
        : <FileClaim options={options} initialRef={sp.incident} initialTx={sp.tx} />}
    </div>
  );
}
