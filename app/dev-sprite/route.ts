import { readFile } from "node:fs/promises";
import path from "node:path";

// Local testing only (MOCK=1). Returns 404 in production.
export async function GET() {
  if (process.env.MOCK !== "1") return new Response("Not found", { status: 404 });
  const buf = await readFile(path.join(process.cwd(), "dev", "mock-sprite.png"));
  return new Response(new Uint8Array(buf), { headers: { "content-type": "image/png" } });
}
