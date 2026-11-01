import type { Repo } from "./github";

export type Door = {
  repo: string;
  outcome: "treat" | "trick";
  label: string;
};

export type Verdict = {
  doors: Door[];
  treats: number;
  tricks: number;
  title: string;
  tagline: string;
};

const DAY = 86_400_000;

function ageLabel(days: number) {
  if (days < 1) return "today";
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

export function knockOnDoors(repos: Repo[], now = Date.now()): Verdict {
  const own = repos.filter((r) => !r.fork);
  const pool = own.length ? own : repos;
  // 5 doors: mix of most-starred and most-recent, deduped
  const byStars = [...pool].sort((a, b) => b.stars - a.stars).slice(0, 3);
  const byPush = [...pool].sort((a, b) => +new Date(b.pushedAt) - +new Date(a.pushedAt));
  const oldest = [...pool].sort((a, b) => +new Date(a.pushedAt) - +new Date(b.pushedAt)).slice(0, 2);
  const picked = new Map<string, Repo>();
  for (const r of [...byStars, ...oldest, ...byPush]) {
    if (picked.size >= 5) break;
    picked.set(r.name, r);
  }

  const doors: Door[] = [...picked.values()].map((r) => {
    const days = (now - +new Date(r.pushedAt)) / DAY;
    const alive = days < 120 || r.stars >= 10;
    return alive
      ? { repo: r.name, outcome: "treat", label: r.stars > 0 ? `★ ${r.stars}` : `pushed ${ageLabel(days)}` }
      : { repo: r.name, outcome: "trick", label: `haunted · ${ageLabel(days)}` };
  });

  const treats = doors.filter((d) => d.outcome === "treat").length;
  const tricks = doors.length - treats;
  const ratio = doors.length ? treats / doors.length : 0;

  let title = "The Empty Bucket";
  let tagline = "No doors to knock on… yet. Ship something spooky.";
  if (doors.length) {
    if (ratio === 1) [title, tagline] = ["Full-Size Candy Bar", "Every repo hands out the good stuff."];
    else if (ratio >= 0.6) [title, tagline] = ["Sugar Rush Shipper", "Mostly treats. A ghost or two in the attic."];
    else if (ratio >= 0.4) [title, tagline] = ["Trick-or-Treater", "Half candy, half cobwebs. Balanced, as all things should be."];
    else if (ratio > 0) [title, tagline] = ["Haunted House Keeper", "Your repos aren't dead. They're just… resting."];
    else [title, tagline] = ["Graveyard Shift", "Every door was a trick. Time to raise the dead."];
  }

  return { doors, treats, tricks, title, tagline };
}
