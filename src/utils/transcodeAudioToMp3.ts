import { assertAudioHasSignal } from "@/utils/audioSignal";
import { getMediaDuration, isVideoMediaFile, needsAudioExtraction } from "@/utils/voiceMediaUpload";

type TranscodeProgressCallback = (percent: number) => void;

export interface TranscodeAudioResult {
  file: File;
  duration: number;
}

let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function buildMp3FileName(originalName: string, suffix = "audio"): string {
  const inputExt = getExtension(originalName);
  const base = inputExt ? originalName.slice(0, -inputExt.length) : originalName;
  const sanitized = (base || "audio").replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${sanitized}-${suffix}.mp3`;
}

/** Map container extension to something FFmpeg recognizes when MIME is missing. */
export function resolveInputExtension(sourceFile: File): string {
  const ext = getExtension(sourceFile.name);
  if (ext && ext !== ".bin") return ext;

  const mime = (sourceFile.type || "").split(";")[0].trim().toLowerCase();
  const mimeToExt: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/3gpp": ".3gp",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/m4a": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    "audio/aac": ".aac",
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
    "audio/opus": ".opus",
  };
  return mimeToExt[mime] || ".bin";
}

function getFFmpegBaseUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("Audio conversion must run in the browser");
  }
  return `${window.location.origin}/ffmpeg`;
}

export async function loadFFmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    const baseURL = getFFmpegBaseUrl();

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    return ffmpeg;
  })().catch((error) => {
    ffmpegPromise = null;
    throw error;
  });

  return ffmpegPromise;
}

export function isMp3File(file: File): boolean {
  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (baseType === "audio/mpeg" || baseType === "audio/mp3") return true;
  return getExtension(file.name) === ".mp3";
}

export function shouldStripVideo(sourceFile: File): boolean {
  return needsAudioExtraction(sourceFile) || isVideoMediaFile(sourceFile);
}

export async function execToMp3(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string,
  outputName: string,
  stripVideo: boolean,
  options?: { startSeconds?: number; durationSeconds?: number }
): Promise<void> {
  const start = options?.startSeconds;
  const duration = options?.durationSeconds;
  // Input seeking (-ss before -i) avoids decoding the whole file for long sources.
  const seekPrefix: string[] =
    typeof start === "number" && Number.isFinite(start) && start > 0.01
      ? ["-ss", start.toFixed(3)]
      : [];
  const durationArgs: string[] =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? ["-t", duration.toFixed(3)]
      : [];

  // Prefer libmp3lame; fall back to q-scale if bitrate mode fails.
  const attempts: string[][] = stripVideo
    ? [
        [
          ...seekPrefix,
          "-i",
          inputName,
          ...durationArgs,
          "-vn",
          "-sn",
          "-dn",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "192k",
          "-ar",
          "44100",
          "-ac",
          "2",
          outputName,
        ],
        [
          ...seekPrefix,
          "-i",
          inputName,
          ...durationArgs,
          "-vn",
          "-sn",
          "-dn",
          "-c:a",
          "libmp3lame",
          "-q:a",
          "2",
          outputName,
        ],
      ]
    : [
        [
          ...seekPrefix,
          "-i",
          inputName,
          ...durationArgs,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "192k",
          "-ar",
          "44100",
          "-ac",
          "2",
          outputName,
        ],
        [
          ...seekPrefix,
          "-i",
          inputName,
          ...durationArgs,
          "-c:a",
          "libmp3lame",
          "-q:a",
          "2",
          outputName,
        ],
      ];

  let lastError: unknown;
  for (const args of attempts) {
    try {
      await ffmpeg.exec(args);
      return;
    } catch (error) {
      lastError = error;
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("FFmpeg could not convert this file to MP3");
}

export async function transcodeAudioToMp3(
  sourceFile: File,
  onProgress?: TranscodeProgressCallback
): Promise<TranscodeAudioResult> {
  if (isMp3File(sourceFile)) {
    await assertAudioHasSignal(sourceFile, { requireDecodable: true, label: "MP3 file" });
    const duration = await getMediaDuration(sourceFile);
    onProgress?.(100);
    return { file: sourceFile, duration };
  }

  const ffmpeg = await loadFFmpeg();
  const inputExt = resolveInputExtension(sourceFile);
  const inputName = `input${inputExt}`;
  const outputName = "output.mp3";
  const { fetchFile } = await import("@ffmpeg/util");

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(99, Math.round(progress * 100)));
  };

  if (onProgress) {
    ffmpeg.on("progress", progressHandler);
  }

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
    await execToMp3(ffmpeg, inputName, outputName, shouldStripVideo(sourceFile));

    const outputData = await ffmpeg.readFile(outputName);
    // Copy out of WASM memory — File/Blob over a live WASM view can end up empty.
    const bytes =
      outputData instanceof Uint8Array
        ? new Uint8Array(outputData)
        : new TextEncoder().encode(String(outputData));

    if (bytes.byteLength < 256) {
      throw new Error("Converted audio file was empty");
    }

    const audioFile = new File([bytes], buildMp3FileName(sourceFile.name), {
      type: "audio/mpeg",
    });

    await assertAudioHasSignal(audioFile, {
      requireDecodable: true,
      label: "Converted MP3",
    });

    const duration = await getMediaDuration(audioFile);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Converted audio has no duration");
    }

    onProgress?.(100);
    return { file: audioFile, duration };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Could not convert this file to MP3";
    throw new Error(message);
  } finally {
    if (onProgress) {
      ffmpeg.off("progress", progressHandler);
    }
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }
  }
}
