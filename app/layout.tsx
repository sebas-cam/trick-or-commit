import type { Metadata } from "next";
import "@fontsource/creepster/400.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Trick or Commit 🎃",
  description: "Your Petdex pet goes trick-or-treating through your GitHub repos. Treats or tricks?",
  openGraph: { title: "Trick or Commit 🎃", description: "Does your GitHub hand out treats or tricks?" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="wrap">{children}</main>
        <footer className="footer">
          Pets by <a href="https://petdex.dev">Petdex</a> (Crafter Station) · Open source on{" "}
          <a href="https://github.com/sebas-cam/trick-or-commit">GitHub</a> · Not affiliated with GitHub or Petdex
        </footer>
      </body>
    </html>
  );
}
