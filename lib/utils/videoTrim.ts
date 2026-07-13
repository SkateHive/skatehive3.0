/**
 * Client-side video trimming via FFmpeg.wasm (single-threaded 0.12 build,
 * no SharedArrayBuffer / COOP-COEP headers needed).
 *
 * Trims the selected [start, end] range with stream copy (`-c copy`) — no
 * re-encode, so it's fast and lossless. Returns an MP4 Blob used by the
 * media-prepare flow before the trimmed clip is uploaded to the transcoder.
 *
 * caveat: copy mode is keyframe-bound (the cut snaps to the nearest
 * keyframe before `start`); frame-accurate cuts need a re-encode, which is
 * far too slow in single-threaded WASM. Switch to re-encode server-side if
 * exact cuts ever matter.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegPromise: Promise<FFmpeg> | null = null;

/**
 * Lazily load the FFmpeg WASM engine (singleton — loaded once, reused across
 * calls). Call this early so the UI can show a "loading trim engine" state
 * before the first trim; createTrimmedVideo awaits it internally either way.
 */
export function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      // Serve core through blob URLs so the worker loads cross-origin-safely.
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
    // A failed load (offline, CDN blocked) shouldn't poison the singleton.
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

// The shared FFmpeg instance can only run one exec at a time, so trims are
// serialized through this promise chain; unique filenames keep a queued
// call's files safe from the previous call's cleanup.
let trimQueue: Promise<unknown> = Promise.resolve();
let trimSeq = 0;

export function createTrimmedVideo(
  file: File,
  start: number,
  end: number
): Promise<Blob> {
  if (end - start <= 0) return Promise.reject(new Error("Invalid trim range"));

  const run = async (): Promise<Blob> => {
    const ffmpeg = await loadFFmpeg();
    const id = ++trimSeq;
    const inputName = `input-${id}.mp4`;
    const outputName = `output-${id}.mp4`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    try {
      const exitCode = await ffmpeg.exec([
        // -ss before -i (input seek): keeps the boundary keyframe. Output
        // seeking drops packets by DTS, and with B-frames the boundary
        // keyframe's DTS < PTS, so it's always discarded — leaving 1-2s of
        // frozen/black video at the start of the trim.
        "-ss", String(start),
        "-i", inputName,
        // Relative end point — input seeking resets timestamps to zero.
        "-to", String(end - start),
        "-c", "copy",
        // Copy-mode cuts can leave negative timestamps; shift them to zero so
        // players don't show a frozen first frame or wrong duration.
        "-avoid_negative_ts", "make_zero",
        outputName,
      ]);
      if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`);
      const data = await ffmpeg.readFile(outputName);
      return new Blob([data as BlobPart], { type: "video/mp4" });
    } finally {
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    }
  };

  const result = trimQueue.then(run, run);
  trimQueue = result.catch(() => {});
  return result;
}
