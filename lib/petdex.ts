export type Pet = {
  slug: string;
  name: string;
  author: string | null;
  spritesheetUrl: string;
};

const MANIFEST_URL = process.env.PETDEX_MANIFEST_URL || "https://petdex.dev/api/manifest";

// The manifest shape isn't formally documented, so normalize defensively.
function findArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  for (const key of ["pets", "data", "items", "results"]) {
    if (Array.isArray(json?.[key])) return json[key];
  }
  return [];
}

function findSpriteUrl(p: any): string | null {
  const direct =
    p.spritesheetUrl ?? p.spritesheet_url ?? p.spritesheet ?? p.sprite ?? p.assets?.spritesheet ?? p.assets?.spritesheetUrl;
  if (typeof direct === "string" && /^https?:\/\//.test(direct)) return direct;
  // fallback: first string value that looks like an image URL
  const stack = [p];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === "string" && /^https?:\/\/.+\.(webp|png)(\?.*)?$/i.test(v)) return v;
    if (v && typeof v === "object") stack.push(...Object.values(v));
  }
  return null;
}

function authorOf(p: any): string | null {
  const a = p.author ?? p.creator ?? p.submitter ?? p.owner;
  if (typeof a === "string") return a;
  if (a && typeof a === "object") return a.handle ?? a.username ?? a.name ?? null;
  return null;
}

export async function getPets(): Promise<Pet[]> {
  if (process.env.MOCK === "1")
    return [{ slug: "mock", name: "Mock Blob", author: "dev", spritesheetUrl: "http://localhost:3000/dev-sprite" }];
  const res = await fetch(MANIFEST_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Petdex manifest error ${res.status}`);
  return findArray(await res.json())
    .map((p): Pet | null => {
      const spritesheetUrl = findSpriteUrl(p);
      const slug = p.slug ?? p.id;
      if (!spritesheetUrl || !slug) return null;
      return { slug: String(slug), name: p.name ?? p.displayName ?? String(slug), author: authorOf(p), spritesheetUrl };
    })
    .filter((p): p is Pet => p !== null);
}

function hash(s: string) {
  let h = 2166136261;
  for (const c of s.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Same username always gets the same pet. */
export function pickPet(pets: Pet[], username: string): Pet | null {
  if (!pets.length) return null;
  return pets[hash(username) % pets.length];
}
