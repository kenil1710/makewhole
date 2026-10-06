import Link from "next/link";
export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "64px 16px" }}>
      <h1>Not in the ledger</h1>
      <p className="lede" style={{ marginTop: 14 }}>There&rsquo;s no record at this address. It may be an incident, claim or account that doesn&rsquo;t exist on this deployment.</p>
      <p style={{ marginTop: 20 }}><Link className="btn" href="/incidents">See all incidents</Link></p>
    </div>
  );
}
