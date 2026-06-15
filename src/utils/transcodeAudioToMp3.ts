import { getMediaDuration } from "@/utils/voiceMediaUpload";

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

function buildMp3FileName(originalName: string): string {
  const inputExt = getExtension(originalName);
  const base = inputExt ? originalName.slice(0, -inputExt.length) : originalName;
  const sanitized = (base || "audio").replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${sanitized}-audio.mp3`;
}

function getFFmpegBaseUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("Audio conversion must run in the browser");
  }
  return `${window.location.origin}/ffmpeg`;
}

async function loadFFmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
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

export async function transcodeAudioToMp3(
  sourceFile: File,
  onProgress?: TranscodeProgressCallback
): Promise<TranscodeAudioResult> {
  if (isMp3File(sourceFile)) {
    const duration = await getMediaDuration(sourceFile);
    onProgress?.(100);
    return { file: sourceFile, duration };
  }

  const ffmpeg = await loadFFmpeg();
  const inputExt = getExtension(sourceFile.name) || ".bin";
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

    const isVideo = sourceFile.type.startsWith("video/");
    const args = isVideo
      ? ["-i", inputName, "-vn", "-c:a", "libmp3lame", "-b:a", "192k", outputName]
      : ["-i", inputName, "-c:a", "libmp3lame", "-b:a", "192k", outputName];

    await ffmpeg.exec(args);

    const outputData = await ffmpeg.readFile(outputName);
    const bytes =
      outputData instanceof Uint8Array
        ? outputData
        : new TextEncoder().encode(String(outputData));

    if (bytes.byteLength === 0) {
      throw new Error("Converted audio file was empty");
    }

    const audioFile = new File([bytes as BlobPart], buildMp3FileName(sourceFile.name), {
      type: "audio/mpeg",
    });
    const duration = await getMediaDuration(audioFile);

    onProgress?.(100);
    return { file: audioFile, duration };
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
