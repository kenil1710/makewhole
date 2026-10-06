import { CopyButton } from "./Copy";
import { short } from "@/lib/format";

/** An address or hash: monospace, shortened, copyable, linked to its explorer. */
export function Hash({ value, href, full = false, label }: { value: string; href?: string; full?: boolean; label?: string }) {
  const text = full ? value : short(value);
  return (
    <span className="hash">
      {href ? (
        <a className="mono" href={href} target="_blank" rel="noreferrer" title={value} aria-label={`${label ?? "Open"} ${value} in explorer`}>{text}</a>
      ) : (
        <span className="mono" title={value}>{text}</span>
      )}
      <CopyButton value={value} label={label ? `Copy ${label}` : "Copy"} />
    </span>
  );
}
