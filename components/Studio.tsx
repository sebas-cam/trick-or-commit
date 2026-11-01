"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { knockAgain } from "@/app/u/[username]/actions";
import { renderSoundtrack } from "@/lib/audio";
import { rememberDoors } from "@/lib/exorcism";
import { exportVideo, type ExportResult } from "@/lib/export";
import { ageLabel, outcomeLabel, UI, verdictText, type Lang, type Theme } from "@/lib/i18n";
import type { Pet } from "@/lib/petdex";
import { HEIGHT, renderFrame, WIDTH, type SceneData } from "@/lib/scene";
import { markExorcised, maskPrivate, type Verdict } from "@/lib/score";
import { useScene } from "./useScene";

type Props = {
  login: string;
  verdict: Verdict;
  pets: Pet[];
  initialPet: Pet;
  lang: Lang;
  initialTheme: Theme;
  siteUrl: string;
  // Set on /me, the signed-in run: if absent, everything here is public data.
  privateRun?: { sharedCount: number; manageUrl: string };
  privateLoginUrl?: string;
};

export default function Studio({ login, verdict: fullVerdict, pets, initialPet, lang, initialTheme, siteUrl, privateRun, privateLoginUrl }: Props) {
  const ui = UI[lang];
  const site = siteUrl.replace(/^https?:\/\//, "");
  const [showNames, setShowNames] = useState(false);
  // Doors that were haunted the last time this browser knocked: repo → days it had been haunted.
  const [exorcised, setExorcised] = useState<Record<string, number>>({});
  const remembered = useRef<Verdict | null>(null);
  useEffect(() => {
    // Once per verdict: a second pass would compare the run against itself and forget the exorcism.
    if (remembered.current === fullVerdict) return;
    remembered.current = fullVerdict;
    setExorcised(rememberDoors(login, fullVerdict));
  }, [login, fullVerdict]);
  const verdict = useMemo(() => {
    const marked = markExorcised(fullVerdict, exorcised);
    return showNames ? marked : maskPrivate(marked, ui.privateRepo);
  }, [showNames, fullVerdict, exorcised, ui.privateRepo]);
  const exorcisedCount = verdict.doors.filter((d) => d.exorcised !== undefined).length;
  // The scariest public door: the one worth exorcising.
  const haunted = [...verdict.doors].reverse().find((d) => d.outcome === "trick" && !d.private);
  const router = useRouter();
  const [knocking, startKnock] = useTransition();
  // Which door the last "knock again" was for: if it's still the haunted one afterwards, say so.
  const [knockedFor, setKnockedFor] = useState<string | null>(null);
  const v = verdictText(verdict, lang);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pet, setPet] = useState(initialPet);
  const [theme, setTheme] = useState(initialTheme);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [video, setVideo] = useState<(ExportResult & { url: string }) | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  const data: SceneData = useMemo(
    () => ({ login, petName: pet.name, verdict, lang, theme, site }),
    [login, pet.name, verdict, lang, theme, site],
  );

  // Live playback follows the scene's clock: restart the track whenever the scene loops.
  const audioRef = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode | null; buffer: AudioBuffer } | null>(null);
  const lastT = useRef(0);
  const { status, atlas, duration, art } = useScene(canvasRef, pet.slug, data, (t) => {
    const audio = audioRef.current;
    if (audio && t < lastT.current) playFrom(0);
    lastT.current = t;
  });

  function playFrom(offset: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.source?.stop();
    const source = audio.ctx.createBufferSource();
    source.buffer = audio.buffer;
    source.connect(audio.ctx.destination);
    source.start(0, offset);
    audio.source = source;
  }

  function stopSound() {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) { audio.source?.stop(); void audio.ctx.close(); }
    setSoundOn(false);
  }

  async function toggleSound() {
    if (audioRef.current) { stopSound(); return; }
    // AudioContext has to be created inside the click for browsers to allow playback.
    const ctx = new AudioContext();
    const buffer = await renderSoundtrack(verdict.doors, theme);
    audioRef.current = { ctx, source: null, buffer };
    playFrom(lastT.current);
    setSoundOn(true);
  }

  useEffect(() => stopSound, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCanShareFiles(
      window.matchMedia("(pointer: coarse)").matches &&
        !!navigator.canShare?.({ files: [new File([new Blob()], "probe.mp4", { type: "video/mp4" })] }),
    );
  }, []);

  function resetVideo() {
    setVideo((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    setFailed(false);
  }

  function pickPet(next: Pet) { if (next.slug !== pet.slug) { resetVideo(); setPet(next); } }

  function pickTheme(next: Theme) {
    if (next === theme) return;
    resetVideo();
    if (audioRef.current) stopSound();
    setTheme(next);
  }

  function toggleNames() {
    resetVideo();
    setShowNames((on) => !on);
  }

  async function render() {
    if (!atlas || !art.current) return;
    const scene = art.current;
    resetVideo();
    setProgress(0);
    try {
      const audio = await renderSoundtrack(verdict.doors, theme);
      const result = await exportVideo({
        duration, audio,
        draw: (ctx, t) => renderFrame(ctx, atlas, scene, t, data),
        onProgress: setProgress,
      });
      setVideo({ ...result, url: URL.createObjectURL(result.blob) });
    } catch {
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  function downloadImage() {
    if (!atlas || !art.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    renderFrame(canvas.getContext("2d")!, atlas, art.current, duration - 0.01, data);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `trick-or-commit-${login}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  const pageUrl = `${siteUrl}/u/${login}?lang=${lang}&theme=${theme}`;
  const shareText = ui.shareText(v.title, verdict.treats, verdict.tricks, exorcisedCount);

  function knock() {
    if (!haunted) return;
    const repo = haunted.repo;
    setKnockedFor(null);
    startKnock(async () => {
      await knockAgain(login);
      router.refresh();
      setKnockedFor(repo);
    });
  }
  const q = encodeURIComponent;

  async function shareVideo() {
    if (!video) return;
    const file = new File([video.blob], `trick-or-commit-${login}.${video.ext}`, { type: video.blob.type });
    // A private run's page is only visible to its owner, so point at the site instead.
    await navigator.share({ files: [file], text: `${shareText} ${privateRun ? siteUrl : pageUrl}` }).catch(() => null);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(pageUrl).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="studio">
      <div className="stage">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="canvas" aria-label={`${v.title}: ${v.tagline}`} />
        {status === "loading" && <p className="stage-note">{ui.summon}</p>}
        {status === "error" && <p className="stage-note">{ui.petError}</p>}
        <button type="button" className="ghost sound" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? ui.mute : ui.sound}
        </button>
      </div>

      <div className="panel">
        <p className="eyebrow">@{login} {ui.is}</p>
        <h1 className="verdict">{v.title}</h1>
        <p className="lead">{v.tagline}</p>

        <dl className="stats">
          <div><dd className="treat">{verdict.treats}</dd><dt>{verdict.treats === 1 ? ui.oneTreat : ui.treats}</dt></div>
          <div><dd className="trick">{verdict.tricks}</dd><dt>{verdict.tricks === 1 ? ui.oneTrick : ui.tricks}</dt></div>
          {verdict.rested > 0 && <div><dd>{verdict.rested}</dd><dt>{verdict.rested === 1 ? ui.oneRested : ui.rested}</dt></div>}
          {verdict.longestStreak !== null && <div><dd>{verdict.longestStreak}</dd><dt>{ui.streak}</dt></div>}
        </dl>
        <p className="stat-line">{v.stat}</p>
        {exorcisedCount > 0 && <p className="stat-line treat">👻 {ui.exorcisedCount(exorcisedCount)}</p>}

        <div className="actions">
          {video ? (
            <a className="btn" href={video.url} download={`trick-or-commit-${login}.${video.ext}`}>
              {ui.downloadVideo} (.{video.ext})
            </a>
          ) : (
            <button type="button" onClick={render} disabled={status !== "ready" || progress !== null}>
              {progress !== null ? ui.rendering(Math.round(progress * 100)) : ui.video}
            </button>
          )}
          <button type="button" className="ghost" onClick={downloadImage} disabled={status !== "ready"}>
            {ui.downloadImage}
          </button>
          {canShareFiles && video && <button type="button" className="ghost" onClick={shareVideo}>{ui.share}</button>}
        </div>
        {failed && <p className="note" role="alert">{ui.renderFail}</p>}
        {video?.ext === "webm" && <p className="note">{ui.webm}</p>}

        {haunted && (
          <section className="exorcism">
            <h2 className="eyebrow">{ui.exorcismTitle}</h2>
            <p className="note">{ui.exorcismBody(haunted.repo)}</p>
            <div className="actions">
              <a className="btn ghost" href={`https://github.com/${login}/${haunted.repo}`} target="_blank" rel="noopener noreferrer">{ui.openRepo}</a>
              <button type="button" className="ghost" onClick={knock} disabled={knocking}>
                {knocking ? ui.knockingAgain : ui.knockAgain}
              </button>
            </div>
            {!knocking && knockedFor === haunted.repo && <p className="note" role="status">{ui.stillHaunted}</p>}
          </section>
        )}

        {privateRun ? (
          <section className="private-run">
            <p className="note">{ui.privateRunNote}</p>
            <p className="stat-line">{privateRun.sharedCount > 0 ? ui.privateCount(privateRun.sharedCount) : ui.noneShared}</p>
            <div className="actions">
              <a className="btn ghost" href={privateRun.manageUrl}>{ui.chooseRepos}</a>
              {privateRun.sharedCount > 0 && (
                <button type="button" className="ghost" onClick={toggleNames} aria-pressed={showNames}>
                  {showNames ? ui.hideNames : ui.showNames}
                </button>
              )}
              <form method="post" action={`/api/auth/logout?lang=${lang}`}>
                <button className="ghost">{ui.signOut}</button>
              </form>
            </div>
          </section>
        ) : (
          <>
            <div className="share">
              <a href={`https://x.com/intent/post?text=${q(shareText)}&url=${q(pageUrl)}`} target="_blank" rel="noopener noreferrer">X</a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${q(pageUrl)}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a href={`https://wa.me/?text=${q(`${shareText} ${pageUrl}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <button type="button" className="link" onClick={copyLink}>{copied ? ui.copied : ui.copy}</button>
            </div>
            {privateLoginUrl && (
              <section>
                <a className="btn ghost" href={privateLoginUrl}>{ui.privateCta}</a>
                <p className="note">{ui.privateHint}</p>
              </section>
            )}
          </>
        )}

        <fieldset className="picker">
          <legend>{ui.theme}</legend>
          {(["halloween", "muertos"] as const).map((t) => (
            <button type="button" key={t} className={t === theme ? "chip on" : "chip"} aria-pressed={t === theme} onClick={() => pickTheme(t)}>
              {ui.themes[t]}
            </button>
          ))}
        </fieldset>

        {pets.length > 1 && (
          <fieldset className="picker">
            <legend>{ui.choosePet}</legend>
            {pets.map((p) => (
              <button type="button" key={p.slug} className={p.slug === pet.slug ? "chip on" : "chip"} aria-pressed={p.slug === pet.slug} onClick={() => pickPet(p)}>
                {p.name}
              </button>
            ))}
          </fieldset>
        )}

        {verdict.doors.length > 0 && (
          <section>
            <h2 className="eyebrow">{ui.log}</h2>
            <ul className="log">
              {verdict.doors.map((d, i) => (
                <li key={i}>
                  <span>{d.repo}</span>
                  <span className={d.outcome}>{outcomeLabel(d, lang)} · {ageLabel(d.days, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="install">
          <h2 className="eyebrow">{ui.install}</h2>
          <code>npx petdex install {pet.slug}</code>
          {pet.author && <p className="note">{pet.name} · {ui.madeBy} {pet.author}</p>}
        </section>

        <Link className="btn ghost" href={`/?lang=${lang}`}>{ui.tryAnother}</Link>
      </div>
    </div>
  );
}
