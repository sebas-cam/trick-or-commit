import { cache } from "react";
import { getProfile } from "@/lib/github";
import { getPets, pickPet } from "@/lib/petdex";
import { knockOnDoors } from "@/lib/score";

export const loadResult = cache(async (username: string) => {
  const profile = await getProfile(username);
  if (!profile) return null;
  const verdict = knockOnDoors(profile.repos);
  let pet = null;
  try {
    pet = pickPet(await getPets(), profile.login);
  } catch {
    pet = null;
  }
  return { profile, verdict, pet };
});
