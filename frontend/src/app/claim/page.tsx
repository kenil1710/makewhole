import type { Metadata } from "next";
import { ClaimForm } from "@/components/v2/ClaimForm";
import { MW2 } from "@/lib/v2";

export const metadata: Metadata = { title: "Claim a refund" };

export default async function Claim({ searchParams }: { searchParams: Promise<{ ref?: string; borrower?: string }> }) {
  const q = await searchParams;
  return (
    <div className="wrap" style={{ paddingTop: 36, maxWidth: 820 }}>
      <h1 className="serif">Claim a refund</h1>
      <p className="lede">Anyone can push a borrower&rsquo;s refund to the borrower&rsquo;s own address, from the claim deadline until the end of the claim window. You pay the transaction and the fee of the value message; the amount and the payee are fixed by code, so pushing someone else&rsquo;s refund only helps them.</p>
      <ClaimForm initialRef={q.ref ?? "c-1"} initialBorrower={q.borrower ?? ""} addresses={MW2} />
    </div>
  );
}
