import type { GitHubProfile, Repo } from "./github";

export type HouseStyle = "mansion" | "cottage" | "ruin";

export type Door = {
  repo: string;
  outcome: "treat" | "trick";
  stars: number;
  days: number;
  language: string | null;
  house: HouseStyle;
  private?: boolean;
};

export type VerdictId =
  | "empty" | "fullSize" | "graveyard" | "nightKnocker"
  | "sugarRush" | "candyHoarder" | "hauntedKeeper" | "trickOrTreater";

export type Verdict = {
  id: VerdictId;
  doors: Door[];
  treats: number;
  tricks: number;
  // The number the verdict hangs on; the wording lives in lib/i18n.ts.
  stat: number;
  longestStreak: number | null;
};

const DAY = 86_400_000;
const DOORS = 5;
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

/** Best-known repos first, the most abandoned one last so the run ends on the scare. */
function pickRepos(pool: Repo[]): Repo[] {
  const age = (r: Repo) => +new Date(r.pushedAt);
  const byStars = [...pool].sort((a, b) => b.stars - a.stars);
  const byPush = [...pool].sort((a, b) => age(b) - age(a));
  const finale = byPush[byPush.length - 1];
  const picked = new Map<string, Repo>();
  for (const r of [...byStars.slice(0, 2), ...byPush, ...byStars]) {
    if (picked.size >= DOORS - 1) break;
    if (r !== finale) picked.set(r.name, r);
  }
  return finale ? [...picked.values(), finale] : [];
}

/** Strips everything identifying from private doors, leaving only the last push. */
export function maskPrivate(verdict: Verdict, label: string): Verdict {
  return {
    ...verdict,
    doors: verdict.doors.map((d) => (d.private ? { ...d, repo: label, language: null, stars: 0 } : d)),
  };
}

export function knockOnDoors(profile: Pick<GitHubProfile, "repos" | "contributions" | "habits">, now = Date.now()): Verdict {
  const own = profile.repos.filter((r) => !r.fork);
  const pool = own.length ? own : profile.repos;

  const doors: Door[] = pickRepos(pool).map((r) => {
    const days = (now - +new Date(r.pushedAt)) / DAY;
    return {
      repo: r.name,
      outcome: isAlive(days, r.stars) ? "treat" : "trick",
      stars: r.stars,
      days,
      language: r.language,
      house: houseFor(days, r.stars),
      private: r.private,
    };
  });

  const treats = doors.filter((d) => d.outcome === "treat").length;
  const tricks = doors.length - treats;
  const dead = pool.filter((r) => (now - +new Date(r.pushedAt)) / DAY >= ABANDONED_DAYS).length;
  const totalStars = pool.reduce((sum, r) => sum + r.stars, 0);
  const { contributions: c, habits: h } = profile;
  const nightPct = h && h.sampled >= 20 ? Math.round(h.nightShare * 100) : 0;

  const base = { doors, treats, tricks, longestStreak: c?.longestStreak ?? null };
  if (!doors.length) return { ...base, id: "empty", stat: 0 };
  if (!treats) return { ...base, id: "graveyard", stat: dead };
  if (nightPct >= 30) return { ...base, id: "nightKnocker", stat: nightPct };
  if (c && c.total >= 1000) return { ...base, id: "sugarRush", stat: c.total };
  if (totalStars >= 100) return { ...base, id: "candyHoarder", stat: totalStars };
  if (!tricks) return { ...base, id: "fullSize", stat: treats };
  if (tricks > treats) return { ...base, id: "hauntedKeeper", stat: dead };
  return { ...base, id: "trickOrTreater", stat: treats };
}
