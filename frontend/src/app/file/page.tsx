import { catalog } from "@/lib/catalog";
import { DEPLOYMENTS } from "@/lib/config";
import { FileClaim, type IncidentOption } from "@/components/FileClaim";

export const revalidate = 60;
export const metadata = { title: "File a claim" };

export default async function FilePage({ searchParams }: { searchParams: Promise<{ incident?: string; tx?: string }> }) {
  const sp = await searchParams;
  const { entries } = await catalog();
  // Test runs stay out of the picker unless a link asks for one directly.
  const options: IncidentOption[] = entries
    .filter((e) => e.group !== "test" || e.ref === sp.incident)
    .map((e) => ({ ref: e.ref, dep: e.dep, address: DEPLOYMENTS[e.dep].address, label: e.name, group: e.group, inc: e.inc }));
  return (
    <div className="wrap" style={{ paddingTop: 40, maxWidth: 880 }}>
      <h1>File a claim</h1>
      <p className="lede" style={{ marginTop: 14 }}>Paste the Ethereum transaction that liquidated the position. You don&rsquo;t need to be the borrower: the refund is always owed to the account in the log.</p>
      {options.length === 0
        ? <p className="notice amber" style={{ marginTop: 24 }}>Incidents couldn&rsquo;t be read just now. Reload in a minute.</p>
        : <FileClaim options={options} initialRef={sp.incident} initialTx={sp.tx} />}
    </div>
  );
}
