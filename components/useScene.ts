"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { buildArt, loadAtlas, renderFrame, sceneDuration, type Atlas, type SceneArt, type SceneData } from "@/lib/scene";

const FONTS = ["30px Creepster", "600 20px 'DM Sans'", "400 18px 'JetBrains Mono'", "700 18px 'JetBrains Mono'"];

/** Loads the pet and fonts, then loops the scene into the canvas. Returns what an export needs to draw the same frames. */
export function useScene(canvasRef: RefObject<HTMLCanvasElement | null>, petSlug: string | null, data: SceneData, onLoop?: (t: number) => void) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const startRef = useRef(0);
  const latest = useRef({ data, onLoop });
  latest.current = { data, onLoop };
  const artRef = useRef<SceneArt | null>(null);
  const { theme, login } = data;
  const doorCount = data.verdict.doors.length;
  // Houses are painted from the door data, so hiding a repo's details has to repaint them.
  const doorsKey = data.verdict.doors.map((d) => `${d.repo}:${d.language}`).join("|");

  useEffect(() => {
    if (!petSlug) { setStatus("error"); return; }
    let alive = true;
    setStatus("loading");
    const fonts = Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => null)));
    Promise.all([loadAtlas(`/api/sprite/${encodeURIComponent(petSlug)}`), fonts])
      .then(([a]) => {
        if (!alive) return;
        setAtlas(a);
        setStatus("ready");
      })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, [petSlug]);

  useEffect(() => {
    if (!atlas || !canvasRef.current) return;
    const art = buildArt(latest.current.data.verdict.doors, theme, login);
    artRef.current = art;
    const ctx = canvasRef.current.getContext("2d")!;
    const duration = sceneDuration(doorCount);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      renderFrame(ctx, atlas, art, duration - 0.01, latest.current.data);
      return;
    }
    let raf = 0;
    startRef.current = performance.now();
    const loop = () => {
      const t = ((performance.now() - startRef.current) / 1000) % (duration + 0.8);
      renderFrame(ctx, atlas, art, Math.min(t, duration - 0.01), latest.current.data);
      latest.current.onLoop?.(t);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [atlas, theme, login, doorCount, doorsKey, canvasRef]);

  return { status, atlas, duration: sceneDuration(doorCount), art: artRef };
}
