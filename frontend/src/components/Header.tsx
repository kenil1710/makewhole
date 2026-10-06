import Link from "next/link";
import { Wordmark } from "./Logo";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./Theme";
import { HOME_REF } from "@/lib/config";

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link href="/" aria-label="MakeWhole home" style={{ textDecoration: "none" }}><Wordmark /></Link>
        <nav aria-label="Main" className="nav">
          <Link href={`/incident/${HOME_REF}`}>Incident</Link>
          <Link href="/file">File a claim</Link>
          <Link href="/balance">Balance</Link>
          <Link href="/how-it-works">How it works</Link>
        </nav>
        <div className="bar-end"><ThemeToggle /><WalletButton /></div>
      </div>
    </header>
  );
}
