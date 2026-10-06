import { BalancePanel } from "@/components/Balance";
export const metadata = { title: "Balance" };
export default function BalancePage() {
  return (
    <div className="wrap" style={{ paddingTop: 40, maxWidth: 880 }}>
      <h1>Balance</h1>
      <p className="lede" style={{ marginTop: 14 }}>Every payment is pulled, never pushed: refunds, returned stakes and anything a refused call sent wait here until you withdraw them. A balance is zeroed before the transfer is sent, so it can&rsquo;t be withdrawn twice.</p>
      <div style={{ marginTop: 28 }}><BalancePanel /></div>
    </div>
  );
}
