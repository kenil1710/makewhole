import { CreateIncident } from "@/components/CreateIncident";
export const metadata = { title: "Create an incident" };
export default function CreatePage() {
  return (
    <div className="wrap" style={{ paddingTop: 40, maxWidth: 880 }}>
      <h1>Create an incident</h1>
      <p className="lede" style={{ marginTop: 14 }}>For the protocol or DAO that owes the refunds. Publish the rules once and fund the pool in the same transaction. After that, anyone can file a claim, code checks each one against Ethereum, and nobody — you included — can change the rules or take the pool back early.</p>
      <CreateIncident />
    </div>
  );
}
