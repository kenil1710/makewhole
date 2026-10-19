import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Newsreader, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { WalletProvider } from "@/components/WalletProvider";
import { CANONICAL, REPO, gladdr } from "@/lib/config";
import { MW2, GATE2 } from "@/lib/v2";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", weight: ["400", "500", "600"], style: ["normal", "italic"] });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap", weight: ["400", "600", "700"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", display: "swap", weight: ["400", "500"] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makewhole-ledger.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "MakeWhole — refunds computed from on-chain liquidations, under frozen terms", template: "%s · MakeWhole" },
  description: "MakeWhole v2 on GenLayer: frozen incident terms, a keeper that files every matching liquidation on Ethereum, Arbitrum, Base, Optimism and Polygon, two-source verification, pro-rata pools and payouts checked at the recipient.",
  openGraph: { type: "website", siteName: "MakeWhole", images: [{ url: "/og.png", width: 1200, height: 630, alt: "MakeWhole — a public restitution ledger" }] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f4ee" }, { media: "(prefers-color-scheme: dark)", color: "#0f1726" }],
};

const themeScript = `try{var t=localStorage.getItem("mw-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${publicSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <WalletProvider>
          <Header />
          <main id="main">{children}</main>
        </WalletProvider>
        <footer className="site-footer">
          <div className="wrap cols">
            <span>MakeWhole runs on GenLayer Studio Dev (chain 61997). Amounts are test GEN at 1 ETH = 0.01 GEN.</span>
            <a href={gladdr(MW2.c)} target="_blank" rel="noreferrer">MakeWhole v2</a>
            <a href={gladdr(MW2.d)} target="_blank" rel="noreferrer">v2 demo</a>
            <a href={gladdr(GATE2.c)} target="_blank" rel="noreferrer">RecoveryGate</a>
            <a href={REPO} target="_blank" rel="noreferrer">Source</a>
            <Link href="/v1">v1 (accepted)</Link>
            <a href={gladdr(CANONICAL)} target="_blank" rel="noreferrer">v1 contract</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
