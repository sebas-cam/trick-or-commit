import {
  AudioBufferSource, BufferTarget, CanvasSource, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec,
  Mp4OutputFormat, Output, QUALITY_HIGH,
} from "mediabunny";
import { HEIGHT, WIDTH } from "./scene";

const FRAME_RATE = 30;

export type ExportJob = {
  duration: number;
  audio: AudioBuffer;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
  onProgress: (ratio: number) => void;
};

export type ExportResult = { blob: Blob; ext: "mp4" | "webm" };

function freshCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH; canvas.height = HEIGHT;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/** Frame by frame, so it's faster than real time and a slow machine can't drop frames. */
async function encodeOffline(job: ExportJob, videoCodec: "avc" | "hevc", audioCodec: "aac" | "opus"): Promise<ExportResult> {
  const { canvas, ctx } = freshCanvas();
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const video = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH });
  const audio = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: FRAME_RATE });
  output.addAudioTrack(audio);
  await output.start();

  const frames = Math.ceil(job.duration * FRAME_RATE);
  for (let f = 0; f < frames; f++) {
    const t = f / FRAME_RATE;
    job.draw(ctx, t);
    await video.add(t, 1 / FRAME_RATE);
    job.onProgress((f + 1) / frames);
    // Keep the page responsive while encoding.
    if (f % 10 === 0) await new Promise((r) => setTimeout(r));
  }
  await audio.add(job.audio);
  await output.finalize();
  return { blob: new Blob([target.buffer!], { type: "video/mp4" }), ext: "mp4" };
}

function pickRecorderMime() {
  const candidates = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** For browsers without WebCodecs: records in real time, so it takes the video's full length. */
function recordRealtime(job: ExportJob): Promise<ExportResult> {
  const mime = pickRecorderMime();
  if (!mime) return Promise.reject(new Error("no video encoder available"));
  const { canvas, ctx } = freshCanvas();
  const audioCtx = new AudioContext();
  const source = audioCtx.createBufferSource();
  source.buffer = job.audio;
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);
  job.draw(ctx, 0);
  const stream = new MediaStream([...canvas.captureStream(FRAME_RATE).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    rec.onerror = () => reject(new Error("recording failed"));
    rec.onstop = () => {
      void audioCtx.close();
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      resolve({ blob: new Blob(chunks, { type: `video/${ext}` }), ext });
    };
    void audioCtx.resume().then(() => {
      const start = performance.now();
      source.start();
      rec.start();
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        if (t >= job.duration) { rec.stop(); return; }
        job.draw(ctx, t);
        job.onProgress(t / job.duration);
        requestAnimationFrame(tick);
      };
      tick();
    });
  });
}

export async function exportVideo(job: ExportJob): Promise<ExportResult> {
  if (typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined") {
    const size = { width: WIDTH, height: HEIGHT };
    const [videoCodec, audioCodec] = await Promise.all([
      getFirstEncodableVideoCodec(["avc", "hevc"], size),
      getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: job.audio.sampleRate }),
    ]);
    if (videoCodec && audioCodec) return encodeOffline(job, videoCodec as "avc" | "hevc", audioCodec as "aac" | "opus");
  }
  return recordRealtime(job);
}
