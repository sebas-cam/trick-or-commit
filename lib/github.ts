export type Repo = {
  name: string;
  stars: number;
  /** Last sign of real work: the newest non-empty commit on the default branch when we can see it, else the last push. */
  activeAt: string;
  language: string | null;
  fork: boolean;
  /** Archived on purpose: finished, not abandoned. */
  archived: boolean;
  private?: boolean;
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

/** Every GitHub fetch for a user carries this tag, so "knock again" can drop just their cache. */
export const profileTag = (login: string) => `gh:${login.toLowerCase()}`;

const MAX_PAGES = 5;

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "trick-or-commit",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// The contributions calendar is GraphQL only, and GraphQL always requires a token.
async function getContributions(login: string, tags: string[]): Promise<Contributions | null> {
  if (!process.env.GITHUB_TOKEN) return null;
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, variables: { login } }),
    next: { revalidate: 3600, tags },
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

async function getHabits(login: string, tags: string[]): Promise<CommitHabits | null> {
  const q = encodeURIComponent(`author:${login}`);
  const res = await fetch(`https://api.github.com/search/commits?q=${q}&sort=author-date&order=desc&per_page=100`, {
    headers: headers(),
    next: { revalidate: 3600, tags },
  });
  if (!res.ok) return null;
  const items: any[] = (await res.json()).items ?? [];
  return habitsFrom(items.map((c) => c.commit?.author?.date).filter((d) => typeof d === "string"));
}

type RawCommit = { committedDate: string; additions: number; deletions: number };

/** Pushes to other branches, tags and `--allow-empty` commits don't count: only a commit that changed something on the default branch does. */
export function lastRealCommit(commits: RawCommit[]): string | null {
  return commits.find((c) => c.additions + c.deletions > 0)?.committedDate ?? null;
}

const REPOS_QUERY = `query($login:String!,$after:String){user(login:$login){repositories(first:100,after:$after,privacy:PUBLIC,ownerAffiliations:OWNER,orderBy:{field:PUSHED_AT,direction:DESC}){pageInfo{hasNextPage endCursor} nodes{name isArchived isFork stargazerCount pushedAt primaryLanguage{name} defaultBranchRef{target{... on Commit{history(first:5){nodes{committedDate additions deletions}}}}}}}}}`;

/** GraphQL (needs the token): sees the default branch, so activity means real commits. */
async function getReposGraphQL(login: string, tags: string[]): Promise<Repo[] | null> {
  const repos: Repo[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res: Response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ query: REPOS_QUERY, variables: { login, after } }),
      next: { revalidate: 3600, tags },
    });
    if (!res.ok) return null;
    const conn: any = (await res.json()).data?.user?.repositories;
    if (!conn) return null;
    for (const r of conn.nodes as any[]) {
      const commits: RawCommit[] = r.defaultBranchRef?.target?.history?.nodes ?? [];
      repos.push({
        name: r.name,
        stars: r.stargazerCount ?? 0,
        // No changed commit in the last 5: fall back to the oldest one we saw, never to the push.
        activeAt: lastRealCommit(commits) ?? commits[commits.length - 1]?.committedDate ?? r.pushedAt,
        language: r.primaryLanguage?.name ?? null,
        fork: !!r.isFork,
        archived: !!r.isArchived,
      });
    }
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return repos;
}

/** REST fallback without a token: only the last push is visible, but every page is read so the oldest repos aren't missed. */
async function getReposREST(username: string, tags: string[]): Promise<Repo[]> {
  const repos: Repo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed&page=${page}`, {
      headers: headers(),
      next: { revalidate: 3600, tags },
    });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const raw: any[] = await res.json();
    for (const r of raw)
      repos.push({
        name: r.name,
        stars: r.stargazers_count ?? 0,
        activeAt: r.pushed_at,
        language: r.language,
        fork: !!r.fork,
        archived: !!r.archived,
      });
    if (raw.length < 100) break;
  }
  return repos;
}

export async function getProfile(username: string): Promise<GitHubProfile | null> {
  if (!isValidUsername(username)) return null;
  if (process.env.MOCK === "1") return mockProfile(username);
  const tags = [profileTag(username)];
  const userRes = await fetch(`https://api.github.com/users/${username}`, { headers: headers(), next: { revalidate: 3600, tags } });
  if (userRes.status === 404) return null;
  if (!userRes.ok) throw new Error(`GitHub API error ${userRes.status}`);
  const user = await userRes.json();
  const [repos, contributions, habits] = await Promise.all([
    (process.env.GITHUB_TOKEN ? getReposGraphQL(user.login, tags).catch(() => null) : Promise.resolve(null))
      .then((r) => r ?? getReposREST(user.login, tags)),
    getContributions(user.login, tags).catch(() => null),
    getHabits(user.login, tags).catch(() => null),
  ]);
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    publicRepos: user.public_repos,
    repos,
    contributions,
    habits,
  };
}

function mockProfile(login: string): GitHubProfile {
  const d = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  return {
    login, name: login, avatarUrl: "", publicRepos: 6,
    repos: [
      { name: "groomie", stars: 24, activeAt: d(2), language: "TypeScript", fork: false, archived: false },
      { name: "kompry-saas", stars: 3, activeAt: d(10), language: "TypeScript", fork: false, archived: false },
      { name: "notscrolling-bot", stars: 1, activeAt: d(400), language: "Python", fork: false, archived: false },
      { name: "old-portfolio-2021", stars: 0, activeAt: d(1500), language: "HTML", fork: false, archived: false },
      { name: "n8n-workflows", stars: 5, activeAt: d(60), language: null, fork: false, archived: false },
      { name: "hackathon-2022", stars: 2, activeAt: d(900), language: "Python", fork: false, archived: true },
    ],
    contributions: { total: 812, longestStreak: 14 },
    habits: { sampled: 100, nightShare: 0.18, weekendShare: 0.22 },
  };
}
