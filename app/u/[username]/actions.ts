"use server";

import { updateTag } from "next/cache";
import { isValidUsername, profileTag } from "@/lib/github";

// Anyone can press "knock again", so keep one refetch per user every 20 s (per server instance).
const COOLDOWN = 20_000;
const lastKnock = new Map<string, number>();

/** Drops this user's cached GitHub data so the next render sees the commit they just pushed. */
export async function knockAgain(login: string): Promise<boolean> {
  if (!isValidUsername(login)) return false;
  const key = login.toLowerCase();
  const now = Date.now();
  if (now - (lastKnock.get(key) ?? 0) < COOLDOWN) return false;
  lastKnock.set(key, now);
  if (lastKnock.size > 5000) lastKnock.clear();
  updateTag(profileTag(login));
  return true;
}
