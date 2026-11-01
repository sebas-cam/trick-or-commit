import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Studio from "@/components/Studio";
import { getProfile, type GitHubProfile, type Repo } from "@/lib/github";
import { getSharedRepos, installUrl, privateReposEnabled, TokenRejected, type SharedRepos } from "@/lib/githubApp";
import { parseLang, parseTheme, UI } from "@/lib/i18n";
import { curatedPets, getPets, pickPet, type Pet } from "@/lib/petdex";
import { knockOnDoors } from "@/lib/score";
import { SESSION_COOKIE, unseal } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Trick or Commit", robots: { index: false, follow: false } };

type Params = { searchParams: Promise<{ lang?: string; theme?: string }> };

function merge(publicRepos: Repo[], shared: Repo[]) {
  const byName = new Map(publicRepos.map((r) => [r.name, r]));
  for (const r of shared) byName.set(r.name, r);
  return [...byName.values()];
}

export default async function PrivateRun({ searchParams }: Params) {
  const query = await searchParams;
  const lang = parseLang(query.lang);
  const ui = UI[lang];
  const login = `/api/auth/github/login?lang=${lang}`;
  if (!privateReposEnabled()) redirect(`/?lang=${lang}`);
  const session = unseal((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect(login);

  let profile: GitHubProfile | null = null;
  let shared: SharedRepos;
  try {
    [profile, shared] = await Promise.all([getProfile(session.login), getSharedRepos(session.token, session.login)]);
  } catch (e) {
    if (e instanceof TokenRejected) redirect(login);
    return (
      <div className="message">
        <h1>{ui.errorTitle}</h1>
        <p className="lead">{ui.errorBody}</p>
        <Link className="btn ghost" href={`/?lang=${lang}`}>{ui.back}</Link>
      </div>
    );
  }
  if (!profile) redirect(`/?lang=${lang}`);

  const verdict = knockOnDoors({ ...profile, repos: merge(profile.repos, shared.repos) });
  let pets: Pet[] = [];
  try {
    pets = curatedPets(await getPets());
  } catch {
    pets = [];
  }
  const pet = pickPet(pets, profile.login);
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
      privateRun={{ sharedCount: shared.repos.filter((r) => r.private).length, manageUrl: installUrl() }}
    />
  );
}
