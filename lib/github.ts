export type Repo = {
  name: string;
  stars: number;
  pushedAt: string;
  language: string | null;
  fork: boolean;
};

export type GitHubProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  repos: Repo[];
};

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidUsername(u: string) {
  return USERNAME_RE.test(u);
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "trick-or-commit",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function getProfile(username: string): Promise<GitHubProfile | null> {
  if (!isValidUsername(username)) return null;
  if (process.env.MOCK === "1") return mockProfile(username);
  const opts = { headers: headers(), next: { revalidate: 3600 } };
  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`, opts),
    fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`, opts),
  ]);
  if (userRes.status === 404) return null;
  if (!userRes.ok || !reposRes.ok) throw new Error(`GitHub API error ${userRes.status}/${reposRes.status}`);
  const user = await userRes.json();
  const rawRepos: any[] = await reposRes.json();
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    publicRepos: user.public_repos,
    repos: rawRepos.map((r) => ({
      name: r.name,
      stars: r.stargazers_count ?? 0,
      pushedAt: r.pushed_at,
      language: r.language,
      fork: !!r.fork,
    })),
  };
}

function mockProfile(login: string): GitHubProfile {
  const d = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  return {
    login, name: login, avatarUrl: "", publicRepos: 6,
    repos: [
      { name: "groomie", stars: 24, pushedAt: d(2), language: "TypeScript", fork: false },
      { name: "kompry-saas", stars: 3, pushedAt: d(10), language: "TypeScript", fork: false },
      { name: "notscrolling-bot", stars: 1, pushedAt: d(400), language: "Python", fork: false },
      { name: "old-portfolio-2021", stars: 0, pushedAt: d(1500), language: "HTML", fork: false },
      { name: "n8n-workflows", stars: 5, pushedAt: d(60), language: null, fork: false },
    ],
  };
}
