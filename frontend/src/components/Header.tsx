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
          <Link href="/incidents">Incidents</Link>
          <Link href="/create">Create</Link>
          <Link href="/file">File a claim</Link>
          <Link href="/appeals">Appeals</Link>
          <Link href="/balance">Balance</Link>
          <Link href="/how-it-works">How it works</Link>
        </nav>
        <div className="bar-end"><ThemeToggle /><WalletButton /></div>
      </div>
    </header>
  );
}
