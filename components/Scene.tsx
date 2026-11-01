"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/score";

type Props = {
  login: string;
  petSlug: string;
  petName: string;
  verdict: Verdict;
};

const SIZE = 720;
// Petdex atlas rows: idle, running-right, running-left, waving, jumping, failed, waiting, running, review
const ROW = { idle: 0, runRight: 1, waving: 3, jumping: 4, failed: 5, waiting: 6 } as const;
const FPS = 8;
const WALK = 1.0, KNOCK = 0.6, REACT = 1.1; // seconds per door phase
const END = 3.5;

type Atlas = { img: HTMLImageElement; fw: number; fh: number; frames: number[] };

function loadAtlas(src: string): Promise<Atlas> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const fw = img.width / 8;
      const rows = Math.max(1, Math.round(img.height / (fw * (208 / 192))));
      const fh = img.height / rows;
      // Count non-empty frames per row so short animations don't flicker.
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const frames: number[] = [];
      for (let r = 0; r < rows; r++) {
        let count = 0;
        for (let col = 0; col < 8; col++) {
          let filled = false;
          const x0 = Math.floor(col * fw), y0 = Math.floor(r * fh);
          for (let y = y0; y < y0 + fh && !filled; y += 4)
            for (let x = x0; x < x0 + fw && !filled; x += 4)
              if (data[(y * img.width + x) * 4 + 3] > 10) filled = true;
          if (filled) count = col + 1;
        }
        frames.push(count);
      }
      resolve({ img, fw, fh, frames });
    };
    img.onerror = () => reject(new Error("sprite failed to load"));
    img.src = src;
  });
}

function totalDuration(doors: number) {
  return doors * (WALK + KNOCK + REACT) + END;
}

function drawPet(ctx: CanvasRenderingContext2D, a: Atlas, row: number, t: number, x: number, y: number, scale: number) {
  const r = a.frames[row] ? row : 0;
  const n = Math.max(1, a.frames[r] || 1);
  const f = Math.floor(t * FPS) % n;
  const w = a.fw * scale, h = a.fh * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(a.img, f * a.fw, r * a.fh, a.fw, a.fh, x - w / 2, y - h, w, h);
}

function house(ctx: CanvasRenderingContext2D, x: number, ground: number, name: string, lit: boolean, hue: number) {
  const w = 190, h = 170;
  ctx.fillStyle = `hsl(${hue} 25% 16%)`;
  ctx.fillRect(x - w / 2, ground - h, w, h);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 18, ground - h);
  ctx.lineTo(x, ground - h - 90);
  ctx.lineTo(x + w / 2 + 18, ground - h);
  ctx.closePath();
  ctx.fillStyle = `hsl(${hue} 30% 10%)`;
  ctx.fill();
  // windows
  ctx.fillStyle = lit ? "#ffb347" : "#2a2238";
  ctx.fillRect(x - 70, ground - h + 30, 38, 34);
  ctx.fillRect(x + 32, ground - h + 30, 38, 34);
  // door
  ctx.fillStyle = "#3b2416";
  ctx.fillRect(x - 24, ground - 78, 48, 78);
  ctx.fillStyle = "#e8b04a";
  ctx.beginPath(); ctx.arc(x + 14, ground - 38, 3.5, 0, Math.PI * 2); ctx.fill();
  // sign with repo name
  const label = name.length > 16 ? name.slice(0, 15) + "…" : name;
  ctx.font = "600 17px 'JetBrains Mono', ui-monospace, Menlo, monospace";
  const tw = ctx.measureText(label).width + 20;
  ctx.fillStyle = "#120c1c";
  ctx.fillRect(x - tw / 2, ground - h - 34, tw, 28);
  ctx.strokeStyle = "#ff7a18"; ctx.lineWidth = 2;
  ctx.strokeRect(x - tw / 2, ground - h - 34, tw, 28);
  ctx.fillStyle = "#ffd9a8"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, x, ground - h - 20);
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, sub: string, good: boolean) {
  ctx.font = "30px Creepster, Impact, fantasy";
  const w1 = ctx.measureText(title).width;
  ctx.font = "500 18px 'JetBrains Mono', ui-monospace, Menlo, monospace";
  const w2 = ctx.measureText(sub).width;
  const w = Math.max(w1, w2) + 36, h = 82;
  const bx = Math.min(Math.max(x - w / 2, 12), SIZE - w - 12);
  ctx.fillStyle = good ? "#ff7a18" : "#7b5cff";
  ctx.beginPath(); ctx.roundRect(bx, y - h, w, h, 16); ctx.fill();
  ctx.fillStyle = "#0b0614"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "30px Creepster, Impact, fantasy";
  ctx.fillText(title, bx + w / 2, y - h + 30);
  ctx.font = "500 18px 'JetBrains Mono', ui-monospace, Menlo, monospace";
  ctx.fillText(sub, bx + w / 2, y - h + 60);
}

function makeStars() {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 70 }, () => ({ x: rnd() * SIZE, y: rnd() * 330, r: rnd() * 1.6 + 0.4 }));
}
const STARS = makeStars();

function render(ctx: CanvasRenderingContext2D, a: Atlas, t: number, p: Props) {
  const { doors } = p.verdict;
  const per = WALK + KNOCK + REACT;
  const spacing = 300, ground = 600;
  const doorX = (i: number) => 360 + i * spacing;

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#07030f"); g.addColorStop(1, "#2a1238");
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  for (const s of STARS) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.x));
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff3c4"; ctx.shadowColor = "#ffd27a"; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(590, 120, 56, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // timeline
  const doorIdx = Math.min(Math.floor(t / per), doors.length);
  const local = t - doorIdx * per;
  let petWorldX: number, row: number = ROW.runRight, showBubble = false;
  if (doorIdx >= doors.length) {
    petWorldX = doorX(doors.length - 1) + 60;
  } else if (local < WALK) {
    const from = doorIdx === 0 ? doorX(0) - spacing : doorX(doorIdx - 1) + 60;
    const k = local / WALK;
    petWorldX = from + (doorX(doorIdx) + 60 - from) * k;
  } else if (local < WALK + KNOCK) {
    petWorldX = doorX(doorIdx) + 60; row = ROW.waiting;
  } else {
    petWorldX = doorX(doorIdx) + 60; showBubble = true;
    row = doors[doorIdx].outcome === "treat" ? ROW.jumping : ROW.failed;
  }
  const cam = petWorldX - 300;

  // ground
  ctx.fillStyle = "#120a1a"; ctx.fillRect(0, ground, SIZE, SIZE - ground);
  ctx.fillStyle = "#1d1028"; ctx.fillRect(0, ground, SIZE, 6);

  doors.forEach((d, i) => {
    const x = doorX(i) - cam;
    if (x < -200 || x > SIZE + 200) return;
    const revealed = i < doorIdx || (i === doorIdx && showBubble);
    house(ctx, x, ground, d.repo, !revealed || d.outcome === "treat", (i * 57) % 360);
    if (revealed) {
      ctx.font = "34px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(d.outcome === "treat" ? "🎃" : "🕸️", x - 70, ground - 8);
    }
  });

  drawPet(ctx, a, row, t, petWorldX - cam, ground + 4, 0.85);

  if (showBubble && doorIdx < doors.length) {
    const d = doors[doorIdx];
    bubble(ctx, petWorldX - cam, ground - 200, d.outcome === "treat" ? "TREAT!" : "TRICK!", d.label, d.outcome === "treat");
  }

  // HUD
  const done = doors.slice(0, doorIdx + (showBubble ? 1 : 0));
  const tr = done.filter((d) => d.outcome === "treat").length;
  ctx.fillStyle = "rgba(11,6,20,.75)"; ctx.beginPath(); ctx.roundRect(16, 16, 330, 50, 12); ctx.fill();
  ctx.fillStyle = "#ffd9a8"; ctx.font = "700 20px 'JetBrains Mono', ui-monospace, Menlo, monospace";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(`@${p.login}  🍬 ${tr}  🕸️ ${done.length - tr}`, 30, 41);

  // end card
  const endT = t - doors.length * per;
  if (endT > 0) {
    const k = Math.min(1, endT / 0.5);
    ctx.fillStyle = `rgba(7,3,15,${0.97 * k})`; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = k; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#ff7a18"; ctx.font = "600 22px 'JetBrains Mono', ui-monospace, Menlo, monospace";
    ctx.fillText(`@${p.login} is a…`, SIZE / 2, 110);
    ctx.fillStyle = "#fff"; ctx.font = "58px Creepster, Impact, fantasy";
    ctx.fillText(p.verdict.title, SIZE / 2, 170);
    ctx.fillStyle = "#cbb8e6"; ctx.font = "500 20px 'DM Sans', system-ui, sans-serif";
    ctx.fillText(p.verdict.tagline, SIZE / 2, 218);
    drawPet(ctx, a, p.verdict.treats >= p.verdict.tricks ? ROW.waving : ROW.failed, t, SIZE / 2, 500, 1.1);
    ctx.fillStyle = "#ffd9a8"; ctx.font = "700 28px 'JetBrains Mono', ui-monospace, Menlo, monospace";
    ctx.fillText(`🍬 ${p.verdict.treats} treats   🕸️ ${p.verdict.tricks} tricks`, SIZE / 2, 560);
    ctx.fillStyle = "#8f7aa8"; ctx.font = "500 16px 'JetBrains Mono', ui-monospace, Menlo, monospace";
    ctx.fillText(`${p.petName} · pets by petdex.dev · trick-or-commit`, SIZE / 2, 680);
    ctx.globalAlpha = 1;
  }
}

function pickMime() {
  const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export default function Scene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const atlasRef = useRef<Atlas | null>(null);
  const startRef = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "recording" | "error">("loading");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ext, setExt] = useState("mp4");
  const duration = totalDuration(props.verdict.doors.length);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const fonts = Promise.all(
      ["30px Creepster", "20px 'DM Sans'", "18px 'JetBrains Mono'"].map((f) => document.fonts.load(f).catch(() => null)),
    );
    Promise.all([loadAtlas(`/api/sprite/${encodeURIComponent(props.petSlug)}`), fonts])
      .then(([a]) => {
        if (!alive) return;
        atlasRef.current = a;
        setStatus("ready");
        startRef.current = performance.now();
        const ctx = canvasRef.current!.getContext("2d")!;
        const loop = () => {
          const t = ((performance.now() - startRef.current) / 1000) % (duration + 0.5);
          render(ctx, a, Math.min(t, duration), props);
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => alive && setStatus("error"));
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.petSlug]);

  async function record() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mime = pickMime();
    if (!mime) { alert("Your browser can't record video. Try Chrome or Safari."); return; }
    setStatus("recording");
    setVideoUrl(null);
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      setExt(mime.includes("mp4") ? "mp4" : "webm");
      setVideoUrl(URL.createObjectURL(blob));
      setStatus("ready");
    };
    startRef.current = performance.now(); // restart the loop from t=0
    rec.start();
    setTimeout(() => rec.stop(), duration * 1000 + 300);
  }

  return (
    <div className="scene">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="canvas" />
      {status === "loading" && <p className="muted">Summoning your pet…</p>}
      {status === "error" && <p className="muted">Couldn&apos;t load the pet sprite. Refresh to try again.</p>}
      <div className="actions">
        <button onClick={record} disabled={status !== "ready"}>
          {status === "recording" ? `Recording… (${Math.ceil(duration)}s)` : "🎬 Render video"}
        </button>
        {videoUrl && (
          <a className="btn" href={videoUrl} download={`trick-or-commit-${props.login}.${ext}`}>
            ⬇️ Download .{ext}
          </a>
        )}
      </div>
      {videoUrl && ext === "webm" && (
        <p className="muted">X needs MP4. Use Chrome 126+ or Safari to export MP4 directly.</p>
      )}
    </div>
  );
}
