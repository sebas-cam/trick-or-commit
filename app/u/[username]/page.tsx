import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import Studio from "@/components/Studio";
import { parseLang, parseTheme, UI, verdictText } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { loadResult } from "./data";

type Params = { params: Promise<{ username: string }>; searchParams: Promise<{ lang?: string; theme?: string }> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { username } = await params;
  const lang = parseLang((await searchParams).lang, (await headers()).get("accept-language") ?? "");
  const r = await loadResult(username).catch(() => null);
  if (!r) return { title: "Trick or Commit" };
  const v = verdictText(r.verdict, lang);
  const title = `@${r.profile.login}: ${v.title}`;
  const description = `${r.verdict.treats} ${UI[lang].treats}, ${r.verdict.tricks} ${UI[lang].tricks}. ${v.tagline}`;
  const images = [{ url: `/api/og/${r.profile.login}?lang=${lang}`, width: 1200, height: 630, alt: title }];
  return { title, description, openGraph: { title, description, images }, twitter: { card: "summary_large_image", title, description, images } };
}

export default async function ResultPage({ params, searchParams }: Params) {
  const { username } = await params;
  const query = await searchParams;
  const lang = parseLang(query.lang, (await headers()).get("accept-language") ?? "");
  const ui = UI[lang];
  let r;
  try {
    r = await loadResult(username);
  } catch {
    return (
      <div className="message">
        <h1>{ui.errorTitle}</h1>
        <p className="lead">{ui.errorBody}</p>
        <Link className="btn ghost" href={`/?lang=${lang}`}>{ui.back}</Link>
      </div>
    );
  }
  if (!r) notFound();

  const { profile, verdict, pets, pet } = r;

  if (!pet) return <div className="message"><p className="lead">{ui.noPet}</p></div>;
  return (
    <Studio
      login={profile.login}
      verdict={verdict}
      pets={pets}
      initialPet={pet}
      lang={lang}
      initialTheme={parseTheme(query.theme)}
      siteUrl={SITE_URL}
    />
  );
}
