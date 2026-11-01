import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { loadResult } from "@/app/u/[username]/data";
import { parseLang, UI, verdictText } from "@/lib/i18n";

const fontFile = (pkg: string, file: string) => readFile(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file));

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const lang = parseLang(new URL(req.url).searchParams.get("lang"));
  const ui = UI[lang];
  const r = await loadResult(username).catch(() => null);
  const v = r && verdictText(r.verdict, lang);
  const [creepster, mono] = await Promise.all([
    fontFile("creepster", "creepster-latin-400-normal.woff"),
    fontFile("jetbrains-mono", "jetbrains-mono-latin-700-normal.woff"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", background: "#0e0a1f", color: "#f4ecff", fontFamily: "JetBrains Mono", position: "relative" }}>
        <div style={{ position: "absolute", top: 56, right: 80, width: 120, height: 120, borderRadius: 60, background: "#fff3c4", display: "flex" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, background: "#07040f", display: "flex" }} />
        {r && v ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, color: "#ffb066", display: "flex" }}>@{r.profile.login} {ui.is}</div>
            <div style={{ fontFamily: "Creepster", fontSize: v.title.length > 18 ? 104 : 136, color: "#ff7a18", marginTop: 12, display: "flex" }}>{v.title}</div>
            <div style={{ fontSize: 38, marginTop: 28, display: "flex", gap: 40 }}>
              <span style={{ color: "#ffb066" }}>{r.verdict.treats} {r.verdict.treats === 1 ? ui.oneTreat : ui.treats}</span>
              <span style={{ color: "#b79cff" }}>{r.verdict.tricks} {r.verdict.tricks === 1 ? ui.oneTrick : ui.tricks}</span>
            </div>
            <div style={{ fontSize: 26, marginTop: 28, color: "#cbbfe0", display: "flex" }}>{v.stat}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Creepster", fontSize: 160, display: "flex" }}>
              Trick or&nbsp;<span style={{ color: "#ff7a18" }}>Commit</span>
            </div>
            <div style={{ fontSize: 32, marginTop: 20, color: "#cbbfe0", display: "flex", maxWidth: 900 }}>{ui.lead}</div>
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Creepster", data: creepster, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 700, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
