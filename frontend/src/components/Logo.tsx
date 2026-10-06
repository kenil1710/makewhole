/** The mark: a ledger line broken by a liquidation, and the line below it made whole. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--ink)" />
      <path d="M7 12.5h7.5M19.5 12.5H25" stroke="var(--paper)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M15.5 9.5l3 6" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 20.5h18" stroke="var(--green)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
export function Wordmark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Mark />
      <span className="serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>MakeWhole</span>
    </span>
  );
}
