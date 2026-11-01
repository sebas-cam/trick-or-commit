import type { Repo } from "./github";
import { SITE_URL } from "./site";

const ALLOW_MOCK = process.env.MOCK === "1";

export function privateReposEnabled() {
  if (ALLOW_MOCK) return !!process.env.SESSION_SECRET;
  const { GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_SLUG, SESSION_SECRET } = process.env;
  return !!(GITHUB_APP_CLIENT_ID && GITHUB_APP_CLIENT_SECRET && GITHUB_APP_SLUG && SESSION_SECRET);
}

export const installUrl = () => `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
export const callbackUrl = () => `${SITE_URL}/api/auth/github/callback`;

// Never cached: these responses belong to one person.
function userHeaders(token: string): HeadersInit {
  return { Accept: "application/vnd.github+json", "User-Agent": "trick-or-commit", Authorization: `Bearer ${token}` };
}

export class TokenRejected extends Error {}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: userHeaders(token), cache: "no-store" });
  if (res.status === 401) throw new TokenRejected();
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json();
}

export async function exchangeCode(code: string, verifier: string): Promise<string | null> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID,
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(),
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return typeof body.access_token === "string" ? body.access_token : null;
}

export async function getLogin(token: string): Promise<string> {
  return (await getJson("https://api.github.com/user", token)).login;
}

export type SharedRepos = { installed: boolean; repos: Repo[] };

/** Only the person's own repos that they chose to share with the app: org installs are left out. */
export async function getSharedRepos(token: string, login: string): Promise<SharedRepos> {
  if (ALLOW_MOCK) return mockShared();
  const { installations } = await getJson("https://api.github.com/user/installations?per_page=100", token);
  const own = (installations as any[]).filter((i) => i.account?.login === login);
  const repos: Repo[] = [];
  for (const installation of own) {
    for (let page = 1; page <= 5; page++) {
      const body = await getJson(`https://api.github.com/user/installations/${installation.id}/repositories?per_page=100&page=${page}`, token);
      for (const r of body.repositories as any[]) {
        if (r.owner?.login !== login) continue;
        repos.push({
          name: r.name,
          stars: r.stargazers_count ?? 0,
          pushedAt: r.pushed_at ?? r.updated_at,
          language: r.language,
          fork: !!r.fork,
          private: !!r.private,
        });
      }
      if (body.repositories.length < 100) break;
    }
  }
  return { installed: own.length > 0, repos };
}

/** Revoking on sign-out means a copied cookie is worthless afterwards too. */
export async function revokeToken(token: string) {
  const { GITHUB_APP_CLIENT_ID: id, GITHUB_APP_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) return;
  await fetch(`https://api.github.com/applications/${id}/grant`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "trick-or-commit",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: token }),
    cache: "no-store",
  }).catch(() => null);
}

function mockShared(): SharedRepos {
  const d = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  return {
    installed: true,
    repos: [
      { name: "acme-client-secret-project", stars: 0, pushedAt: d(1), language: "Rust", fork: false, private: true },
      { name: "stealth-startup", stars: 0, pushedAt: d(900), language: "Go", fork: false, private: true },
    ],
  };
}
