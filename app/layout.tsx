import type { Metadata } from "next";
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
          <a href="https://github.com/">GitHub</a> · Not affiliated with GitHub or Petdex
        </footer>
      </body>
    </html>
  );
}
