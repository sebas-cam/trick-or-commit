import { getPets } from "@/lib/petdex";

// Same-origin proxy so the canvas isn't tainted and can be recorded to video.
// Only serves spritesheets listed in the Petdex manifest (no open proxy).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pet = (await getPets()).find((p) => p.slug === slug);
  if (!pet) return new Response("Not found", { status: 404 });

  const res = await fetch(pet.spritesheetUrl, { next: { revalidate: 86400 } });
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const type = res.headers.get("content-type") ?? "image/webp";
  if (!type.startsWith("image/")) return new Response("Bad upstream type", { status: 502 });

  return new Response(res.body, {
    headers: { "content-type": type, "cache-control": "public, max-age=86400, s-maxage=86400" },
  });
}
