import { headers } from "next/headers";
import Link from "next/link";
import { parseLang, UI } from "@/lib/i18n";

export default async function NotFound() {
  const h = await headers();
  const lang = parseLang(h.get("x-lang") ?? undefined, h.get("accept-language") ?? "");
  const ui = UI[lang];
  return (
    <div className="message">
      <h1>{ui.notFoundTitle}</h1>
      <p className="lead">{ui.notFoundBody}</p>
      <Link className="btn ghost" href={`/?lang=${lang}`}>{ui.back}</Link>
    </div>
  );
}
