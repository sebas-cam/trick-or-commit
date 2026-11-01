import type { GitHubProfile, Repo } from "./github";

export type HouseStyle = "mansion" | "cottage" | "ruin";

/** "rest" is an archived repo: retired on purpose, so it neither treats nor tricks. */
export type Outcome = "treat" | "trick" | "rest";

export type Door = {
  repo: string;
  outcome: Outcome;
  stars: number;
  days: number;
  language: string | null;
  house: HouseStyle;
  private?: boolean;
  /** Set in the browser when this repo was haunted on a previous visit: how long it had been haunted then. */
  exorcised?: number;
};

export type VerdictId =
  | "empty" | "fullSize" | "graveyard" | "nightKnocker"
  | "sugarRush" | "candyHoarder" | "hauntedKeeper" | "trickOrTreater" | "curator";

export type Verdict = {
  id: VerdictId;
  doors: Door[];
  treats: number;
  tricks: number;
  rested: number;
  // The number the verdict hangs on; the wording lives in lib/i18n.ts.
  stat: number;
  longestStreak: number | null;
};

const DAY = 86_400_000;
const DOORS = 10;
const TOP_STARRED = 2, RECENT_UNTIL = 7, OLD_UNTIL = 9;
const ACTIVE_DAYS = 120;
const ABANDONED_DAYS = 365;

/** Stars buy a repo some grace, but no repo stays alive forever without a push. */
export function isAlive(days: number, stars: number) {
  return days < ACTIVE_DAYS || (stars >= 10 && days < ABANDONED_DAYS);
}

function houseFor(days: number, stars: number): HouseStyle {
  if (!isAlive(days, stars)) return "ruin";
  return stars >= 10 || days < 30 ? "mansion" : "cottage";
}

/**
 * Best-known repos, then recent ones, then a few old ones, with the most abandoned last so the run ends on the scare.
 * Archived repos can show up as a door but never as the finale: they were retired, not abandoned.
 */
function pickRepos(pool: Repo[]): Repo[] {
  const age = (r: Repo) => +new Date(r.activeAt);
  const byStars = [...pool].sort((a, b) => b.stars - a.stars);
  const byPush = [...pool].sort((a, b) => age(b) - age(a));
  const open = byPush.filter((r) => !r.archived);
  const finale = open[open.length - 1] ?? byPush[byPush.length - 1];
  const picked = new Map<string, Repo>();
  const take = (repos: Repo[], until: number) => {
    for (const r of repos) {
      if (picked.size >= until) break;
      if (r !== finale) picked.set(r.name, r);
    }
  };
  take(byStars, TOP_STARRED);
  take(byPush, RECENT_UNTIL);
  take([...byPush].reverse(), OLD_UNTIL);
  return finale ? [...picked.values(), finale] : [];
}

/** Strips everything identifying from private doors, leaving only the last push. */
/** Doors that were haunted on an earlier visit and are alive now get the exorcism scene; the score doesn't change. */
export function markExorcised(verdict: Verdict, previous: Record<string, number>): Verdict {
  if (!verdict.doors.some((d) => d.outcome === "treat" && previous[d.repo] !== undefined)) return verdict;
  return {
    ...verdict,
    doors: verdict.doors.map((d) => (d.outcome === "treat" && previous[d.repo] !== undefined ? { ...d, exorcised: previous[d.repo] } : d)),
  };
}

export function maskPrivate(verdict: Verdict, label: string): Verdict {
  return {
    ...verdict,
    doors: verdict.doors.map((d) => (d.private ? { ...d, repo: label, language: null, stars: 0 } : d)),
  };
}

export function knockOnDoors(profile: Pick<GitHubProfile, "repos" | "contributions" | "habits">, now = Date.now()): Verdict {
  const own = profile.repos.filter((r) => !r.fork);
  const pool = own.length ? own : profile.repos;

  const daysOf = (r: Repo) => (now - +new Date(r.activeAt)) / DAY;
  const outcomeOf = (r: Repo): Outcome => (r.archived ? "rest" : isAlive(daysOf(r), r.stars) ? "treat" : "trick");

  const doors: Door[] = pickRepos(pool).map((r) => {
    const days = daysOf(r);
    return {
      repo: r.name,
      outcome: outcomeOf(r),
      stars: r.stars,
      days,
      language: r.language,
      house: houseFor(days, r.stars),
      private: r.private,
    };
  });

  // The doors are only the highlights: the score covers every repo.
  const treats = pool.filter((r) => outcomeOf(r) === "treat").length;
  const rested = pool.filter((r) => r.archived).length;
  const tricks = pool.length - treats - rested;
  const dead = pool.filter((r) => !r.archived && daysOf(r) >= ABANDONED_DAYS).length;
  const totalStars = pool.reduce((sum, r) => sum + r.stars, 0);
  const { contributions: c, habits: h } = profile;
  const nightPct = h && h.sampled >= 20 ? Math.round(h.nightShare * 100) : 0;

  const base = { doors, treats, tricks, rested, longestStreak: c?.longestStreak ?? null };
  if (!doors.length) return { ...base, id: "empty", stat: 0 };
  if (!treats && !tricks) return { ...base, id: "curator", stat: rested };
  if (!treats) return { ...base, id: "graveyard", stat: dead };
  if (nightPct >= 30) return { ...base, id: "nightKnocker", stat: nightPct };
  if (c && c.total >= 1000) return { ...base, id: "sugarRush", stat: c.total };
  if (totalStars >= 100) return { ...base, id: "candyHoarder", stat: totalStars };
  if (!tricks) return { ...base, id: "fullSize", stat: treats };
  if (tricks > treats) return { ...base, id: "hauntedKeeper", stat: dead };
  return { ...base, id: "trickOrTreater", stat: treats };
}
