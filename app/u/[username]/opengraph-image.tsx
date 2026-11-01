import { ImageResponse } from "next/og";
import { loadResult } from "./data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Trick or Commit result";

export default async function OG({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const r = await loadResult(username).catch(() => null);
  const login = r?.profile.login ?? username;
  const title = r?.verdict.title ?? "Trick or Commit";
  const treats = r?.verdict.treats ?? 0;
  const tricks = r?.verdict.tricks ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(180deg, #07030f 0%, #2a1238 100%)", color: "#f4ecff",
        }}
      >
        <div style={{ fontSize: 34, color: "#ff7a18", display: "flex" }}>@{login} is a…</div>
        <div style={{ fontSize: 96, fontWeight: 900, marginTop: 8, display: "flex" }}>{title}</div>
        <div style={{ fontSize: 44, marginTop: 28, color: "#ffd9a8", display: "flex" }}>
          {treats} treats · {tricks} tricks
        </div>
        <div style={{ fontSize: 26, marginTop: 48, color: "#9a88b5", display: "flex" }}>
          TRICK OR COMMIT · pets by petdex.dev
        </div>
      </div>
    ),
    size,
  );
}
