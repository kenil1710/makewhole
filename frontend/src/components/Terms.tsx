import { CopyButton } from "./Copy";

/** The frozen terms as a document. Clause lines get anchors; one clause can be marked as relied upon. */
export function TermsDoc({ terms, sha, highlight, tone = "green" }: { terms: string; sha: string; highlight?: string; tone?: "green" | "red" }) {
  const blocks = terms.split(/\n\s*\n/);
  return (
    <article className="terms sheet" aria-label="Frozen terms">
      <header className="terms-head">
        <span className="small muted">sha256 of the exact text, recorded at creation</span>
        <span className="hash"><span className="mono small" style={{ overflowWrap: "anywhere" }}>{sha}</span><CopyButton value={sha} label="Copy terms sha256" /></span>
      </header>
      <div className={`terms-body${highlight ? " open" : ""}`}>
        {blocks.map((b, i) => {
          const lines = b.split("\n");
          return (
            <div key={i}>
              {lines.map((line, j) => {
                const m = /^\[([A-Z]\d+)\]\s?(.*)$/.exec(line.trim());
                if (m) {
                  const on = highlight === m[1];
                  return (
                    <p key={j} id={`clause-${m[1]}`} className={`clause${on ? ` relied ${tone}` : ""}`}>
                      <span className="cid mono">{m[1]}</span>
                      <span>{m[2]}{on && <span className="relied-note">The decision relied on this clause.</span>}</span>
                    </p>
                  );
                }
                if (i === 0 && j === 0) return <h3 key={j} style={{ marginBottom: 8 }}>{line}</h3>;
                if (/^PART [AB]\./.test(line)) return <h4 key={j} className="part">{line}</h4>;
                return <p key={j} className={line.startsWith('"') ? "quote" : undefined}>{line}</p>;
              })}
            </div>
          );
        })}
      </div>
    </article>
  );
}
