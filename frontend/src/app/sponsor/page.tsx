import type { Metadata } from "next";
import { SponsorDashboard } from "@/components/v2/SponsorDashboard";
import { MW2 } from "@/lib/v2";
import templates from "@/data/incidents-v2.json";

export const metadata: Metadata = { title: "Sponsor dashboard" };

export default function Sponsor() {
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h1 className="serif">Sponsor dashboard</h1>
      <p className="lede">Open an incident with frozen terms and fund its pool in one transaction. Before the first filing you may amend the terms; after it you can only top the pool up or extend the deadline. After the claim deadline anyone may return the part of the pool above the total owed to you; after the claim window anyone may close the incident, which returns everything left to you.</p>
      <SponsorDashboard addresses={MW2} templates={templates as Record<string, { config: Record<string, unknown>; terms: string }>} />
    </div>
  );
}
