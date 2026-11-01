import type { Verdict } from "./score";

// No database: each browser remembers which of a user's doors were haunted on its last visit.
// Only public doors are kept, so private repo names never end up in storage.
type Memory = {
  /** repo → how many days it had been haunted when we last saw it */
  haunted: Record<string, number>;
  /** repo → { days it was haunted, when we saw it exorcised }, kept a day so a reload still shows it */
  exorcised: Record<string, { days: number; at: number }>;
};

const KEY = (login: string) => `toc:doors:${login.toLowerCase()}`;
const KEEP_EXORCISED = 86_400_000;
const MAX_HAUNTED = 60;

function load(login: string): Memory {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(login)) ?? "null");
    if (raw && typeof raw.haunted === "object" && typeof raw.exorcised === "object") return raw;
  } catch {}
  return { haunted: {}, exorcised: {} };
}

/**
 * Compares this run with the last one in this browser and saves the new state.
 * Returns repo → days it had been haunted, for every door that was haunted before and gives treats now.
 */
export function rememberDoors(login: string, verdict: Verdict, now = Date.now()): Record<string, number> {
  const prev = load(login);
  const result: Record<string, number> = {};
  const next: Memory = { haunted: {}, exorcised: {} };

  for (const [repo, e] of Object.entries(prev.exorcised)) if (now - e.at < KEEP_EXORCISED) next.exorcised[repo] = e;
  // Repos that aren't doors this time stay remembered, so they can still be exorcised later.
  const shown = new Set(verdict.doors.map((d) => d.repo));
  for (const [repo, days] of Object.entries(prev.haunted)) if (!shown.has(repo)) next.haunted[repo] = days;

  for (const d of verdict.doors) {
    if (d.private) continue;
    if (d.outcome === "trick") {
      next.haunted[d.repo] = d.days;
      delete next.exorcised[d.repo];
    } else if (d.outcome === "treat") {
      const was = prev.haunted[d.repo];
      if (was !== undefined) next.exorcised[d.repo] = { days: was, at: now };
      if (next.exorcised[d.repo]) result[d.repo] = next.exorcised[d.repo].days;
    }
  }

  const haunted = Object.entries(next.haunted).sort((a, b) => b[1] - a[1]).slice(0, MAX_HAUNTED);
  next.haunted = Object.fromEntries(haunted);
  try {
    localStorage.setItem(KEY(login), JSON.stringify(next));
  } catch {}
  return result;
}
