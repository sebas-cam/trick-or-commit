import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Scene from "@/components/Scene";
import { loadResult } from "./data";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const r = await loadResult(username).catch(() => null);
  if (!r) return { title: "Trick or Commit 🎃" };
  const title = `@${r.profile.login} is a ${r.verdict.title} 🎃`;
  const description = `${r.verdict.treats} treats, ${r.verdict.tricks} tricks. ${r.verdict.tagline}`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function ResultPage({ params }: Params) {
  const { username } = await params;
  let r;
  try {
    r = await loadResult(username);
  } catch {
    return (
      <>
        <h1>👻 Spooky error</h1>
        <p className="lead">GitHub is rate-limiting us right now. Try again in a minute.</p>
        <Link className="btn ghost" href="/">Back</Link>
      </>
    );
  }
  if (!r) notFound();

  const { profile, verdict, pet } = r;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const shareText = `My Petdex pet went trick-or-treating through my GitHub repos 🎃\n\n🍬 ${verdict.treats} treats · 🕸️ ${verdict.tricks} tricks → "${verdict.title}"\n\nTry yours:`;
  const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${site}/u/${profile.login}`)}`;

  return (
    <>
      <h1 style={{ fontSize: "clamp(32px,6vw,52px)" }}>
        @{profile.login} is a <span>{verdict.title}</span>
      </h1>
      <p className="lead">{verdict.tagline}</p>

      {pet ? (
        <Scene login={profile.login} petSlug={pet.slug} petName={pet.name} verdict={verdict} />
      ) : (
        <p className="muted">Couldn&apos;t reach Petdex for a pet right now. Refresh in a moment.</p>
      )}

      <div className="actions" style={{ marginTop: 12 }}>
        <a className="btn" href={shareUrl} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <Link className="btn ghost" href="/">Try another</Link>
      </div>

      <ol className="steps">
        <li>Hit <b>Render video</b> and wait for the full run.</li>
        <li>Download it, then attach it to your post on X.</li>
        {pet && (
          <li>
            Like your pet? <code>npx petdex install {pet.slug}</code>
            {pet.author ? <> · made by {pet.author}</> : null}
          </li>
        )}
      </ol>
    </>
  );
}
