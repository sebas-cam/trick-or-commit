export type Repo = {
  name: string;
  stars: number;
  pushedAt: string;
  language: string | null;
  fork: boolean;
};

export type Contributions = {
  total: number;
  longestStreak: number;
};

export type CommitHabits = {
  sampled: number;
  nightShare: number;
  weekendShare: number;
};

export type GitHubProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  repos: Repo[];
  // Both are best effort: null when there's no token or the API said no.
  contributions: Contributions | null;
  habits: CommitHabits | null;
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

// The contributions calendar is GraphQL only, and GraphQL always requires a token.
async function getContributions(login: string): Promise<Contributions | null> {
  if (!process.env.GITHUB_TOKEN) return null;
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, variables: { login } }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const calendar = (await res.json()).data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) return null;
  let longestStreak = 0, streak = 0;
  for (const week of calendar.weeks)
    for (const day of week.contributionDays) {
      streak = day.contributionCount > 0 ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
    }
  return { total: calendar.totalContributions, longestStreak };
}

/** Commit dates carry the author's UTC offset, so reading them as written gives their local time. */
export function habitsFrom(dates: string[]): CommitHabits | null {
  if (!dates.length) return null;
  let night = 0, weekend = 0;
  for (const iso of dates) {
    if (+iso.slice(11, 13) < 5) night++;
    // Date.UTC on the written date, so the offset can't push it into another day.
    const day = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay();
    if (day === 0 || day === 6) weekend++;
  }
  return { sampled: dates.length, nightShare: night / dates.length, weekendShare: weekend / dates.length };
}

async function getHabits(login: string): Promise<CommitHabits | null> {
  const q = encodeURIComponent(`author:${login}`);
  const res = await fetch(`https://api.github.com/search/commits?q=${q}&sort=author-date&order=desc&per_page=100`, {
    headers: headers(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const items: any[] = (await res.json()).items ?? [];
  return habitsFrom(items.map((c) => c.commit?.author?.date).filter((d) => typeof d === "string"));
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
  const [contributions, habits] = await Promise.all([
    getContributions(user.login).catch(() => null),
    getHabits(user.login).catch(() => null),
  ]);
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
    contributions,
    habits,
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
    contributions: { total: 812, longestStreak: 14 },
    habits: { sampled: 100, nightShare: 0.18, weekendShare: 0.22 },
  };
}
