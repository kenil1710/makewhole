export default function Loading() {
  return (
    <div className="wrap" style={{ paddingTop: 48 }} aria-busy="true" aria-label="Loading the ledger">
      <div className="skeleton" style={{ height: 44, width: "70%" }} />
      <div className="skeleton" style={{ height: 20, width: "55%", marginTop: 18 }} />
      <div className="skeleton" style={{ height: 20, width: "48%", marginTop: 10 }} />
      <div style={{ display: "grid", gap: 10, marginTop: 40 }}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 36 }} />)}
      </div>
    </div>
  );
}
