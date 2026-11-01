import DemoScene from "@/components/DemoScene";
import KnockForm from "@/components/KnockForm";
import { privateReposEnabled } from "@/lib/githubApp";
import { parseLang, UI, VERDICT_IDS, verdictText } from "@/lib/i18n";
import { curatedPets, getPets, type Pet } from "@/lib/petdex";
import { SITE_HOST } from "@/lib/site";

type Params = { searchParams: Promise<{ lang?: string; auth?: string }> };

export default async function Home({ searchParams }: Params) {
  const query = await searchParams;
  const lang = parseLang(query.lang);
  const ui = UI[lang];
  let pet: Pet | null = null;
  try {
    pet = curatedPets(await getPets())[0] ?? null;
  } catch {
    pet = null;
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{ui.eyebrow}</p>
          <h1>Trick or <span>Commit</span></h1>
          <p className="lead">{ui.lead}</p>
          <KnockForm lang={lang} />
          {query.auth === "failed" && <p className="note" role="alert">{ui.authFailed}</p>}
          {privateReposEnabled() && (
            <p className="note">
              <a href={`/api/auth/github/login?lang=${lang}`}>{ui.privateCta}</a>. {ui.privateHint}
            </p>
          )}
        </div>
        <div className="hero-demo">
          {pet && <DemoScene petSlug={pet.slug} petName={pet.name} lang={lang} site={SITE_HOST} />}
        </div>
      </section>

      <ol className="how">
        {ui.how.map(([title, body]) => (
          <li key={title}><strong>{title}</strong><span>{body}</span></li>
        ))}
      </ol>

      <section className="verdicts">
        <h2>{ui.titles}</h2>
        <ul>
          {VERDICT_IDS.map((id) => {
            const v = verdictText({ id, stat: 0 }, lang);
            return <li key={id}><strong>{v.title}</strong><span>{v.tagline}</span></li>;
          })}
        </ul>
      </section>
    </>
  );
}
