"use client";

import { useRef } from "react";
import { knockOnDoors } from "@/lib/score";
import type { Lang } from "@/lib/i18n";
import { HEIGHT, WIDTH } from "@/lib/scene";
import { useScene } from "./useScene";

const DAY = 86_400_000;
const when = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// Sample repos, only here to show what a run looks like before you enter a username.
const VERDICT = knockOnDoors({
  repos: [
    { name: "my-saas", stars: 42, pushedAt: when(3), language: "TypeScript", fork: false },
    { name: "dotfiles", stars: 2, pushedAt: when(45), language: "Shell", fork: false },
    { name: "todo-app-final-v3", stars: 0, pushedAt: when(1400), language: "JavaScript", fork: false },
  ],
  contributions: null,
  habits: null,
});

export default function DemoScene({ petSlug, petName, lang, site }: { petSlug: string | null; petName: string; lang: Lang; site: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useScene(canvasRef, petSlug, { login: "your-username", petName, verdict: VERDICT, lang, theme: "halloween", site });
  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="canvas demo" aria-hidden="true" />;
}
