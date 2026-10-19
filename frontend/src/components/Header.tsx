import Link from "next/link";
import { Wordmark } from "./Logo";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./Theme";

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link href="/" aria-label="MakeWhole home" style={{ textDecoration: "none" }}><Wordmark /></Link>
        <nav aria-label="Main" className="nav">
          <Link href="/eligible">Am I eligible?</Link>
          <Link href="/explorer">Incidents</Link>
          <Link href="/claim">Claim</Link>
          <Link href="/sponsor">Sponsor</Link>
          <Link href="/keeper">Keeper</Link>
          <Link href="/gate">Gate</Link>
          <Link href="/docs">Rules</Link>
          <Link href="/verify">Verify</Link>
        </nav>
        <div className="bar-end"><ThemeToggle /><WalletButton /></div>
      </div>
    </header>
  );
}
