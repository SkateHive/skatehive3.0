/**
 * Client-side video trimming via FFmpeg.wasm (single-threaded 0.12 build,
 * no SharedArrayBuffer / COOP-COEP headers needed).
 *
 * Trims the selected [start, end] range with stream copy (`-c copy`) — no
 * re-encode, so it's fast and lossless. Returns an MP4 Blob used by the
 * media-prepare flow before the trimmed clip is uploaded to the transcoder.
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

export async function createTrimmedVideo(
  file: File,
  start: number,
  end: number
): Promise<Blob> {
  if (end - start <= 0) throw new Error("Invalid trim range");

  const ffmpeg = await loadFFmpeg();
  await ffmpeg.writeFile("input.mp4", await fetchFile(file));
  try {
    const exitCode = await ffmpeg.exec([
      "-i", "input.mp4",
      "-ss", String(start),
      "-to", String(end),
      "-c", "copy",
      "output.mp4",
    ]);
    if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`);
    const data = await ffmpeg.readFile("output.mp4");
    return new Blob([data as BlobPart], { type: "video/mp4" });
  } finally {
    await ffmpeg.deleteFile("input.mp4").catch(() => {});
    await ffmpeg.deleteFile("output.mp4").catch(() => {});
  }
}
