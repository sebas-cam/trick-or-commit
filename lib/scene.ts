import { doorLine, UI, verdictText, type Lang, type Theme } from "./i18n";
import type { Door, HouseStyle, Verdict } from "./score";

export const WIDTH = 1080;
export const HEIGHT = 1920;
// Everything but the pet and the text is drawn at quarter resolution, then scaled up, so it stays chunky pixel art.
const PX = 4;
const LW = WIDTH / PX, LH = HEIGHT / PX;
const GROUND = 404;
const SPACING = 300;

// Petdex atlas rows: idle, running-right, running-left, waving, jumping, failed, waiting, running, review
const ROW = { runRight: 1, waving: 3, jumping: 4, failed: 5, waiting: 6 } as const;
const FPS = 8;
const PET_SCALE = 2;
// Where the pet stands on screen, and how far ahead of it the house sits, so it never covers the door.
const PET_SCREEN_X = 66, HOUSE_AHEAD = 112;
export const INTRO = 1.8, WALK = 1.0, KNOCK = 0.9, REACT = 1.7, END = 5;
const PER = WALK + KNOCK + REACT;

const DISPLAY = "Creepster, Impact, fantasy";
const BODY = "'DM Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export function sceneDuration(doors: number) {
  return INTRO + doors * PER + END;
}

/** When each door gets knocked, shared with the soundtrack so sound and picture can't drift. */
export function doorTimes(i: number) {
  const walk = INTRO + i * PER;
  return { knock: walk + WALK, react: walk + WALK + KNOCK };
}

export type Atlas = { img: HTMLImageElement; fw: number; fh: number; frames: number[] };

export function loadAtlas(src: string): Promise<Atlas> {
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

const PALETTES = {
  halloween: {
    sky: ["#07040f", "#0e0a1f", "#17102f", "#221640", "#30194d", "#42205a"],
    moon: "#fff3c4", moonEdge: "#e8d48c", hillFar: "#1a1233", hillNear: "#120c26",
    ground: "#07040f", groundTop: "#1d1436", accent: "#ff7a18", accentSoft: "#ffb066",
    trick: "#b79cff", ink: "#0e0a1f", text: "#f4ecff", muted: "#cbbfe0",
    wall: { mansion: "#3a2a5e", cottage: "#2c1f4d", ruin: "#1e1830" }, roof: "#171029", lit: "#ffb347",
    candy: ["#ff7a18", "#ffd166", "#ef476f", "#7bdff2", "#b2f7a1"],
  },
  muertos: {
    sky: ["#16041f", "#2a0732", "#470b45", "#6b1150", "#961d55", "#c4344f"],
    moon: "#ffd166", moonEdge: "#f4a72c", hillFar: "#3a0a3f", hillNear: "#24062c",
    ground: "#16041f", groundTop: "#4a1147", accent: "#ff9f1c", accentSoft: "#ffd166",
    trick: "#7bdff2", ink: "#16041f", text: "#fff4e0", muted: "#f2cfe0",
    wall: { mansion: "#c2185b", cottage: "#00838f", ruin: "#4a2545" }, roof: "#3b0f3f", lit: "#ffd166",
    candy: ["#ff9f1c", "#ffd166", "#ec407a", "#26c6da", "#ab47bc"],
  },
};
type Palette = (typeof PALETTES)["halloween"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2654435761) >>> 0), (s ^ (s >>> 13)) / 4294967296 + 0.5) % 1;
}

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function layer(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { c, g: c.getContext("2d")! };
}

const PUMPKIN = ["....gg....", "...oog....", ".oooooooo.", "oooooooooo", "ooyooooyoo", "oyyyooyyyo", "oooooooooo", "ooyoyoyyoo", ".ooyyyyoo.", "..oooooo.."];
const GHOST = ["...wwwww...", "..wwwwwww..", ".wwwwwwwww.", ".wwkwwwkww.", ".wwkwwwkww.", ".wwwwwwwww.", ".wwwwkwwww.", ".wwwwwwwww.", ".wwwwwwwww.", ".wwwwwwwww.", ".ww.www.ww.", ".w...w...w."];
const MARIGOLD = [".o.o.o.", "ooyoyoo", ".oyyyo.", "ooyoyoo", ".o.o.o.", "...g...", "..gg..."];
const CANDLE = ["...y...", "..yoy..", "...y...", "..www..", "..www..", "..www..", "..www..", ".ggggg."];
const GRAVE = ["..sssss..", ".sssssss.", "sssdsdsss", "sssssssss", "sssdddsss", "sssssssss", "sssssssss"];

function sprite(g: CanvasRenderingContext2D, map: string[], x: number, y: number, colors: Record<string, string>) {
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = colors[row[i]];
      if (col) { g.fillStyle = col; g.fillRect(x + i, y + j, 1, 1); }
    }
  });
}

const OBJECT_COLORS = { o: "#ff7a18", y: "#ffd166", g: "#3f8f3a", w: "#f4ecff", k: "#0e0a1f", s: "#6b6680", d: "#3f3b52" };

function paintHouse(style: HouseStyle, seed: number, language: string | null, pal: Palette) {
  const W = 220, H = 230;
  const { c, g } = layer(W, H);
  const rnd = rng(seed);
  const hue = language ? hash(language) % 360 : 30;
  const trim = `hsl(${hue} 55% 55%)`;
  const cx = W / 2;
  const wall = pal.wall[style];
  const window_ = (x: number, y: number, lit: boolean) => {
    g.fillStyle = "#0a0614"; g.fillRect(x - 1, y - 1, 14, 16);
    g.fillStyle = lit ? pal.lit : "#2a2238"; g.fillRect(x, y, 12, 14);
    g.fillStyle = "#0a0614"; g.fillRect(x + 5, y, 2, 14); g.fillRect(x, y + 6, 12, 2);
  };
  const texture = (x: number, y: number, w: number, h: number) => {
    for (let i = 0; i < (w * h) / 60; i++) {
      g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.14)";
      g.fillRect(x + Math.floor(rnd() * (w - 6)), y + Math.floor(rnd() * h), 6, 2);
    }
  };
  const roof = (x: number, y: number, w: number, h: number) => {
    for (let i = 0; i < h; i++) {
      const inset = Math.round((i / h) * (w / 2 - 10));
      g.fillStyle = pal.roof; g.fillRect(x + inset, y - i, w - inset * 2, 1);
      g.fillStyle = trim; g.fillRect(x + inset, y - i, 2, 1); g.fillRect(x + w - inset - 2, y - i, 2, 1);
    }
  };

  if (style === "mansion") {
    g.fillStyle = wall; g.fillRect(cx - 78, H - 130, 156, 130);
    texture(cx - 78, H - 130, 156, 130);
    g.fillRect(cx + 42, H - 172, 40, 60);
    g.fillStyle = wall; g.fillRect(cx + 42, H - 172, 40, 60);
    roof(cx - 88, H - 130, 176, 46);
    roof(cx + 36, H - 172, 52, 40);
    for (const x of [cx - 66, cx - 34, cx + 22, cx + 52]) { window_(x, H - 118, true); window_(x, H - 76, true); }
    window_(cx + 56, H - 160, true);
  } else if (style === "cottage") {
    g.fillStyle = wall; g.fillRect(cx - 62, H - 86, 124, 86);
    texture(cx - 62, H - 86, 124, 86);
    g.fillStyle = "#1d1436"; g.fillRect(cx + 30, H - 138, 14, 34);
    roof(cx - 72, H - 86, 144, 44);
    window_(cx - 46, H - 66, true); window_(cx + 32, H - 66, rnd() > 0.3);
  } else {
    g.fillStyle = wall; g.fillRect(cx - 68, H - 100, 136, 100);
    texture(cx - 68, H - 100, 136, 100);
    roof(cx - 76, H - 100, 150, 40);
    // Bite chunks out of the roof and wall, then board up what's left.
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 26; i++) g.fillRect(cx - 76 + rnd() * 150, H - 142 + rnd() * 34, 4 + rnd() * 10, 3 + rnd() * 8);
    g.fillRect(cx + 44, H - 104, 26, 20);
    g.globalCompositeOperation = "source-over";
    window_(cx - 52, H - 78, false); window_(cx + 36, H - 78, false);
    g.fillStyle = "#4a3320";
    g.save(); g.translate(cx - 46, H - 72); g.rotate(0.4); g.fillRect(-12, -2, 24, 4); g.restore();
    g.save(); g.translate(cx + 42, H - 72); g.rotate(-0.5); g.fillRect(-12, -2, 24, 4); g.restore();
    // Cobweb in the corner.
    g.strokeStyle = "rgba(244,236,255,.55)"; g.lineWidth = 1;
    for (const r of [8, 14, 20]) { g.beginPath(); g.moveTo(cx - 68 + r, H - 100); g.lineTo(cx - 68, H - 100 + r); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 68, H - 100); g.lineTo(cx - 52, H - 84); g.stroke();
  }
  return c;
}

export type SceneArt = {
  sky: HTMLCanvasElement; far: HTMLCanvasElement; near: HTMLCanvasElement; ground: HTMLCanvasElement;
  houses: HTMLCanvasElement[]; buffer: HTMLCanvasElement; bufferCtx: CanvasRenderingContext2D;
  stars: { x: number; y: number; p: number }[]; pal: Palette;
};

function ridge(w: number, h: number, base: number, amp: number, color: string, seed: number, trees: boolean) {
  const { c, g } = layer(w, h);
  const rnd = rng(seed);
  const a = 1 + Math.floor(rnd() * 2), b = 3 + Math.floor(rnd() * 3);
  g.fillStyle = color;
  for (let x = 0; x < w; x++) {
    const k = (x / w) * Math.PI * 2;
    const y = Math.round(base + amp * (Math.sin(k * a) * 0.6 + Math.sin(k * b + seed) * 0.4));
    g.fillRect(x, y, 1, h - y);
  }
  if (trees) {
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(rnd() * (w - 30)) + 10, th = 14 + rnd() * 22;
      const y = base - amp;
      g.fillRect(x, y - th, 2, th + amp * 2);
      for (let j = 0; j < 5; j++) {
        const by = y - th + j * 4, len = 4 + rnd() * 8, dir = j % 2 ? 1 : -1;
        for (let l = 0; l < len; l++) g.fillRect(x + dir * l, by - Math.floor(l / 2), 1, 1);
      }
    }
  }
  return c;
}

export function buildArt(doors: Door[], theme: Theme, seedText: string): SceneArt {
  const pal = PALETTES[theme];
  const seed = hash(seedText);
  const rnd = rng(seed);

  const sky = layer(LW, LH);
  pal.sky.forEach((col, i) => {
    sky.g.fillStyle = col;
    sky.g.fillRect(0, Math.round((i / pal.sky.length) * GROUND), LW, LH);
    // Dither each band edge so the gradient reads as pixel art.
    if (i > 0) {
      const y = Math.round((i / pal.sky.length) * GROUND);
      for (let x = 0; x < LW; x += 2) sky.g.fillRect(x + (i % 2), y - 2, 1, 2);
    }
  });

  const ground = layer(LW * 2, LH - GROUND);
  ground.g.fillStyle = pal.ground; ground.g.fillRect(0, 0, LW * 2, LH);
  ground.g.fillStyle = pal.groundTop; ground.g.fillRect(0, 0, LW * 2, 3);
  for (let i = 0; i < 180; i++) {
    ground.g.fillStyle = rnd() > 0.5 ? pal.groundTop : "rgba(255,255,255,.04)";
    ground.g.fillRect(Math.floor(rnd() * LW * 2), 3 + Math.floor(rnd() * 60), 3, 1);
  }

  return {
    sky: sky.c,
    far: ridge(LW * 2, LH, GROUND - 90, 22, pal.hillFar, seed ^ 11, false),
    near: ridge(LW * 2, LH, GROUND - 40, 12, pal.hillNear, seed ^ 23, true),
    ground: ground.c,
    houses: doors.map((d) => paintHouse(d.house, hash(d.repo), d.language, pal)),
    ...(() => { const b = layer(LW, LH); return { buffer: b.c, bufferCtx: b.g }; })(),
    stars: Array.from({ length: 60 }, () => ({ x: Math.floor(rnd() * LW), y: Math.floor(rnd() * 230), p: rnd() * 6 })),
    pal,
  };
}

export type SceneData = { login: string; petName: string; verdict: Verdict; lang: Lang; theme: Theme; site: string };

function drawPet(ctx: CanvasRenderingContext2D, a: Atlas, row: number, t: number, x: number, y: number, scale: number) {
  const r = a.frames[row] ? row : 0;
  const n = Math.max(1, a.frames[r] || 1);
  const f = Math.floor(t * FPS) % n;
  const w = a.fw * scale, h = a.fh * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(a.img, f * a.fw, r * a.fh, a.fw, a.fh, x - w / 2, y - h, w, h);
}

function tile(g: CanvasRenderingContext2D, img: HTMLCanvasElement, offset: number, y = 0) {
  const x = -(((offset % img.width) + img.width) % img.width);
  g.drawImage(img, x, y);
  if (x + img.width < LW) g.drawImage(img, x + img.width, y);
}

function drawDoor(g: CanvasRenderingContext2D, x: number, state: "closed" | "knock" | "treat" | "trick", t: number, pal: Palette) {
  const dw = 28, dh = 46, top = GROUND - dh;
  const jitter = state === "knock" ? Math.round(Math.sin(t * 40)) : 0;
  g.fillStyle = "#0a0614"; g.fillRect(x - dw / 2 - 2, top - 2, dw + 4, dh + 2);
  if (state === "treat") {
    g.fillStyle = pal.lit; g.fillRect(x - dw / 2, top, dw, dh);
    g.fillStyle = "rgba(255,179,71,.22)"; g.beginPath();
    g.moveTo(x - dw / 2, GROUND); g.lineTo(x + dw / 2, GROUND); g.lineTo(x + dw, GROUND + 26); g.lineTo(x - dw, GROUND + 26); g.fill();
  } else if (state === "trick") {
    g.fillStyle = "#000"; g.fillRect(x - dw / 2, top, dw, dh);
    g.fillStyle = pal.trick;
    if (Math.floor(t * 3) % 4 !== 0) { g.fillRect(x - 7, top + 14, 4, 4); g.fillRect(x + 3, top + 14, 4, 4); }
  } else {
    g.fillStyle = "#5a3216"; g.fillRect(x - dw / 2 + jitter, top, dw, dh);
    g.fillStyle = "#3b2010"; g.fillRect(x - dw / 2 + 4 + jitter, top + 5, dw - 8, 14); g.fillRect(x - dw / 2 + 4 + jitter, top + 24, dw - 8, 17);
    g.fillStyle = pal.accentSoft; g.fillRect(x + 7 + jitter, top + 22, 3, 3);
  }
}

function drawCandy(g: CanvasRenderingContext2D, x: number, rt: number, seed: number, pal: Palette) {
  const rnd = rng(seed);
  for (let i = 0; i < 26; i++) {
    const vx = (rnd() - 0.5) * 150, vy = 70 + rnd() * 120, col = pal.candy[Math.floor(rnd() * pal.candy.length)];
    const delay = rnd() * 0.25, tt = Math.max(0, rt - delay);
    if (!tt) continue;
    const px = x + vx * tt, py = Math.min(GROUND - 24 - vy * tt + 150 * tt * tt, GROUND + 4);
    g.fillStyle = col; g.fillRect(Math.round(px), Math.round(py), 3, 3);
    g.fillRect(Math.round(px) - 1, Math.round(py) + 1, 1, 1); g.fillRect(Math.round(px) + 3, Math.round(py) + 1, 1, 1);
  }
}

function drawBats(g: CanvasRenderingContext2D, x: number, rt: number) {
  g.fillStyle = "#0a0614";
  for (let i = 0; i < 5; i++) {
    const bx = x + Math.sin(i * 2.1) * 26 + (i - 2) * 26 * rt, by = GROUND - 60 - rt * (50 + i * 20) + Math.sin(rt * 7 + i) * 6;
    const flap = Math.floor(rt * 10 + i) % 2;
    g.fillRect(bx, by, 3, 3);
    g.fillRect(bx - 4, by - flap, 4, 1); g.fillRect(bx + 3, by - flap, 4, 1);
  }
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, stroke = 0) {
  ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round"; ctx.lineWidth = stroke; ctx.strokeStyle = "#07040f";
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color; ctx.fillText(value, x, y);
}

function fitLines(ctx: CanvasRenderingContext2D, value: string, family: string, maxW: number, start: number, min: number) {
  const words = value.split(" ");
  for (let size = start; size >= min; size -= 4) {
    ctx.font = `${size}px ${family}`;
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
    }
    lines.push(line);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size, lines };
  }
  return { size: min, lines: [value] };
}

function shorten(name: string, max: number) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

const easeBack = (k: number) => { const c = 1.7; const u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

function drawEnd(ctx: CanvasRenderingContext2D, a: Atlas, art: SceneArt, t: number, k: number, d: SceneData) {
  const { verdict, lang, login } = d;
  const ui = UI[lang], pal = art.pal;
  const v = verdictText(verdict, lang);
  ctx.fillStyle = `rgba(7,4,15,${0.9 * k})`; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = k;
  text(ctx, `@${login} ${ui.is}`, WIDTH / 2, 290, `700 46px ${MONO}`, pal.accentSoft);
  const fit = fitLines(ctx, v.title, DISPLAY, 960, 190, 90);
  fit.lines.forEach((l, i) => text(ctx, l, WIDTH / 2, 420 + (i + 0.3) * fit.size, `${fit.size}px ${DISPLAY}`, pal.accent, 10));
  const below = 420 + fit.lines.length * fit.size + 70;
  text(ctx, v.tagline, WIDTH / 2, below, `600 38px ${BODY}`, pal.text);
  drawPet(ctx, a, verdict.treats >= verdict.tricks ? ROW.waving : ROW.failed, t, WIDTH / 2, 1420, 2.1);

  const cells: [string, string, string][] = [
    [String(verdict.treats), verdict.treats === 1 ? ui.oneTreat : ui.treats, pal.accentSoft],
    [String(verdict.tricks), verdict.tricks === 1 ? ui.oneTrick : ui.tricks, pal.trick],
  ];
  if (verdict.longestStreak !== null) cells.push([String(verdict.longestStreak), ui.streak, pal.text]);
  const cw = 300;
  cells.forEach(([n, label, col], i) => {
    const x = WIDTH / 2 + (i - (cells.length - 1) / 2) * cw;
    text(ctx, n, x, 1480, `700 76px ${MONO}`, col);
    text(ctx, label, x, 1548, `400 30px ${MONO}`, pal.muted);
  });
  text(ctx, v.stat, WIDTH / 2, 1640, `400 ${v.stat.length > 44 ? 28 : 32}px ${MONO}`, pal.text);
  ctx.globalAlpha = 1;
}

export function renderFrame(ctx: CanvasRenderingContext2D, a: Atlas, art: SceneArt, t: number, d: SceneData) {
  const { doors } = d.verdict;
  const ui = UI[d.lang], pal = art.pal;
  const walked = t - INTRO;
  const i = walked < 0 ? 0 : Math.min(Math.floor(walked / PER), doors.length);
  const local = walked < 0 ? 0 : walked - i * PER;
  const finished = i >= doors.length;
  const stop = (n: number) => n * SPACING;

  let petX: number, row: number = ROW.runRight;
  let doorState: "closed" | "knock" | "treat" | "trick" = "closed";
  if (walked < 0) petX = stop(0) - SPACING + (SPACING * 0.3 * (t / INTRO));
  else if (finished) petX = stop(Math.max(0, doors.length - 1));
  else if (local < WALK) {
    const from = i === 0 ? stop(0) - SPACING * 0.7 : stop(i - 1);
    petX = from + (stop(i) - from) * (local / WALK);
  } else if (local < WALK + KNOCK) { petX = stop(i); row = ROW.waiting; doorState = "knock"; }
  else {
    petX = stop(i);
    doorState = doors[i].outcome;
    row = doors[i].outcome === "treat" ? ROW.jumping : ROW.failed;
  }
  const cam = petX - PET_SCREEN_X;
  const rt = !finished && doorState !== "closed" && doorState !== "knock" ? local - WALK - KNOCK : -1;
  const shake = doorState === "trick" && rt < 0.45 ? Math.round(Math.sin(rt * 70) * 3 * (1 - rt / 0.45)) : 0;

  const g = art.bufferCtx;
  g.imageSmoothingEnabled = false;
  g.drawImage(art.sky, 0, 0);
  for (const s of art.stars) {
    if (Math.floor(t * 2 + s.p) % 5 === 0) continue;
    g.fillStyle = "#fff"; g.fillRect(s.x, s.y, 1, 1);
  }
  // Low enough to clear the repo sign, far enough right to clear the TREAT/TRICK text.
  const mx = 234 - cam * 0.01, my = 112;
  g.fillStyle = pal.moon;
  g.beginPath(); g.arc(mx, my, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = pal.moonEdge;
  for (const [ox, oy, r] of [[-7, -6, 4], [8, 4, 6], [-3, 11, 3]]) { g.beginPath(); g.arc(mx + ox, my + oy, r, 0, Math.PI * 2); g.fill(); }
  tile(g, art.far, cam * 0.2);
  tile(g, art.near, cam * 0.45);

  doors.forEach((door, n) => {
    const hx = stop(n) + HOUSE_AHEAD - cam;
    if (hx < -130 || hx > LW + 130) return;
    const house = art.houses[n];
    g.drawImage(house, hx - house.width / 2, GROUND - house.height);
    const passed = n < i;
    drawDoor(g, hx, n === i ? doorState : passed ? door.outcome : "closed", t, pal);
    if (d.theme === "muertos") {
      sprite(g, door.outcome === "treat" ? MARIGOLD : CANDLE, hx - 54, GROUND - 8, OBJECT_COLORS);
      sprite(g, MARIGOLD, hx + 42, GROUND - 7, OBJECT_COLORS);
    } else if (door.house === "ruin") {
      sprite(g, GRAVE, hx + 46, GROUND - 7, OBJECT_COLORS);
    } else {
      sprite(g, PUMPKIN, hx + 42, GROUND - 10, OBJECT_COLORS);
    }
  });
  tile(g, art.ground, cam, GROUND);

  // Drifting fog, in front of the houses.
  g.fillStyle = "rgba(244,236,255,.05)";
  for (let f = 0; f < 3; f++) {
    const fx = ((t * (6 + f * 4) + f * 90) % (LW + 120)) - 120;
    g.fillRect(Math.round(fx), GROUND - 18 - f * 8, 150, 8);
    g.fillRect(Math.round(fx) + 30, GROUND - 26 - f * 8, 70, 8);
  }

  if (rt >= 0) {
    const hx = stop(i) + HOUSE_AHEAD - cam;
    if (doorState === "treat") drawCandy(g, hx, rt, i + 1, pal);
    else {
      const gy = GROUND - 46 - Math.min(rt * 90, 70) + Math.sin(rt * 6) * 3;
      sprite(g, GHOST, Math.round(hx - 5), Math.round(gy), OBJECT_COLORS);
      drawBats(g, hx, rt);
    }
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(art.buffer, shake * PX, 0, WIDTH, HEIGHT);
  if (doorState === "trick" && rt < 0.3) {
    ctx.fillStyle = `rgba(90,50,200,${0.4 * (1 - rt / 0.3)})`; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  // The end card draws its own, bigger pet, so this one bows out as the card fades in.
  ctx.globalAlpha = finished ? Math.max(0, 1 - local / 0.3) : 1;
  if (doors.length) drawPet(ctx, a, row, t, (petX - cam + shake) * PX, GROUND * PX + 16, PET_SCALE);
  ctx.globalAlpha = 1;

  // HUD
  ctx.textBaseline = "middle";
  const seen = doors.slice(0, i + (rt >= 0 ? 1 : 0));
  const treats = seen.filter((x) => x.outcome === "treat").length;
  if (walked >= 0 && !finished) {
    const door = doors[i];
    ctx.textAlign = "left"; ctx.font = `700 34px ${MONO}`; ctx.fillStyle = pal.text;
    ctx.fillText(`@${shorten(d.login, 20)}`, 56, 150);
    ctx.textAlign = "right"; ctx.font = `400 30px ${MONO}`; ctx.fillStyle = pal.muted;
    ctx.fillText(ui.door(i + 1, doors.length), WIDTH - 56, 150);
    ctx.font = `700 54px ${MONO}`;
    const name = shorten(door.repo, 26);
    const nw = ctx.measureText(name).width + 56;
    ctx.fillStyle = pal.ink; ctx.fillRect(WIDTH / 2 - nw / 2, 216, nw, 88);
    ctx.fillStyle = pal.accent; ctx.fillRect(WIDTH / 2 - nw / 2, 300, nw, 4);
    text(ctx, name, WIDTH / 2, 260, `700 54px ${MONO}`, pal.text);
  }
  if (doorState === "knock") {
    const beat = Math.floor((local - WALK) * 4);
    if (beat < 3) text(ctx, d.lang === "es" ? "¡TOC!" : "KNOCK!", (petX - cam + HOUSE_AHEAD) * PX, 1290 - beat * 70, `${72 + beat * 14}px ${DISPLAY}`, pal.text, 8);
  }
  if (rt >= 0) {
    const door = doors[i];
    const pop = easeBack(Math.min(1, rt / 0.28));
    ctx.save();
    ctx.translate(WIDTH / 2, 520); ctx.scale(pop, pop);
    const treat = door.outcome === "treat";
    text(ctx, treat ? ui.treat : ui.trick, 0, 0, `176px ${DISPLAY}`, treat ? pal.accent : pal.trick, 14);
    ctx.restore();
    if (rt > 0.15) {
      ctx.font = `700 40px ${MONO}`;
      const line = doorLine(door, d.lang);
      const lw = ctx.measureText(line).width + 44;
      ctx.fillStyle = pal.ink; ctx.fillRect(WIDTH / 2 - lw / 2, 636, lw, 68);
      text(ctx, line, WIDTH / 2, 672, `700 40px ${MONO}`, pal.text);
    }
  }
  if (walked >= 0 && !finished) {
    text(ctx, `${ui.treats} ${treats}   ${ui.tricks} ${seen.length - treats}`, WIDTH / 2, 1730, `700 40px ${MONO}`, pal.accentSoft);
  }

  if (walked < 0) {
    const k = Math.min(1, t / 0.3) * Math.min(1, (INTRO - t) / 0.25);
    ctx.globalAlpha = Math.max(0, k);
    const title = fitLines(ctx, "Trick or Commit", DISPLAY, 960, 190, 100);
    title.lines.forEach((l, n) => text(ctx, l, WIDTH / 2, 500 + n * title.size, `${title.size}px ${DISPLAY}`, n ? pal.accent : pal.text, 12));
    text(ctx, `@${shorten(d.login, 26)}`, WIDTH / 2, 500 + title.lines.length * title.size, `700 48px ${MONO}`, pal.accentSoft);
    ctx.globalAlpha = 1;
  }
  if (finished) drawEnd(ctx, a, art, t, Math.min(1, (local) / 0.5), d);

  text(ctx, `${d.petName} · petdex.dev · ${d.site}`, WIDTH / 2, 1810, `400 26px ${MONO}`, pal.muted);
}
