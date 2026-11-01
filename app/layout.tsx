import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource/creepster/400.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import Link from "next/link";
import { parseLang, UI } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Trick or Commit",
  description: "Your Petdex pet goes trick-or-treating through your GitHub repos. Treats or tricks?",
  openGraph: { title: "Trick or Commit", description: "Does your GitHub hand out treats or tricks?", images: ["/api/og/_"] },
  twitter: { card: "summary_large_image", images: ["/api/og/_"] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const lang = parseLang(h.get("x-lang") ?? undefined, h.get("accept-language") ?? "");
  const ui = UI[lang];
  return (
    <html lang={lang}>
      <body>
        <header className="top">
          <Link href="/" className="brand">trick-or-commit</Link>
          <nav>
            {/* Plain links: the layout has to re-render to pick up the language. */}
            <a href="?lang=es">ES</a>
            <a href="?lang=en">EN</a>
            <a href="https://github.com/sebas-cam/trick-or-commit">GitHub</a>
          </nav>
        </header>
        <main className="wrap">{children}</main>
        <footer className="footer">
          {ui.footer} <a href="https://petdex.dev">Petdex</a> (Crafter Station) · <a href="https://github.com/sebas-cam/trick-or-commit">GitHub</a> · {ui.notAffiliated}
        </footer>
      </body>
    </html>
  );
}
