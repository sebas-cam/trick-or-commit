import { cache } from "react";
import { getProfile } from "@/lib/github";
import { curatedPets, getPets, pickPet, type Pet } from "@/lib/petdex";
import { knockOnDoors } from "@/lib/score";

export const loadResult = cache(async (username: string) => {
  const profile = await getProfile(username);
  if (!profile) return null;
  const verdict = knockOnDoors(profile);
  let pets: Pet[] = [];
  try {
    pets = curatedPets(await getPets());
  } catch {
    pets = [];
  }
  return { profile, verdict, pets, pet: pickPet(pets, profile.login) };
});
