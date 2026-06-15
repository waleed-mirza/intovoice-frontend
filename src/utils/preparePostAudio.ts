import { extractAudioFromVideoNative } from "@/utils/extractAudioFromVideoNative";
import {
  isMp3File,
  transcodeAudioToMp3,
  type TranscodeAudioResult,
} from "@/utils/transcodeAudioToMp3";
import { getMediaDuration, needsAudioExtraction } from "@/utils/voiceMediaUpload";

type ProgressCallback = (percent: number) => void;

const MOBILE_RE = /Android|iPhone|iPad|iPod/i;
const FFMPEG_MAX_BYTES = 150 * 1024 * 1024;

/** Matches backend `allowedAudioTypes` in routes/voice/upload.ts */
const DIRECT_UPLOAD_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/webm",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
]);

const DIRECT_UPLOAD_AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".wav",
  ".ogg",
  ".webm",
  ".aac",
  ".flac",
]);

export function canUploadAudioDirectly(file: File): boolean {
  if (needsAudioExtraction(file)) return false;
  if (isMp3File(file)) return true;

  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (DIRECT_UPLOAD_AUDIO_TYPES.has(baseType)) return true;

  const dot = file.name.lastIndexOf(".");
  if (dot >= 0 && DIRECT_UPLOAD_AUDIO_EXTENSIONS.has(file.name.slice(dot).toLowerCase())) {
    return true;
  }

  return false;
}

function shouldTryFfmpeg(file: File): boolean {
  if (typeof navigator !== "undefined" && MOBILE_RE.test(navigator.userAgent)) {
    return false;
  }
  return file.size <= FFMPEG_MAX_BYTES;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export async function preparePostAudioForUpload(
  sourceFile: File,
  onProgress?: ProgressCallback
): Promise<TranscodeAudioResult> {
  if (canUploadAudioDirectly(sourceFile)) {
    const duration = await getMediaDuration(sourceFile);
    onProgress?.(100);
    return { file: sourceFile, duration };
  }

  if (needsAudioExtraction(sourceFile)) {
    try {
      onProgress?.(0);
      return await extractAudioFromVideoNative(sourceFile, onProgress);
    } catch (nativeError) {
      const nativeMessage = toErrorMessage(nativeError, "Video audio extraction failed");

      if (shouldTryFfmpeg(sourceFile)) {
        try {
          onProgress?.(0);
          return await transcodeAudioToMp3(sourceFile, onProgress);
        } catch (ffmpegError) {
          throw new Error(
            `${nativeMessage}. ${toErrorMessage(ffmpegError, "Browser conversion also failed")}`
          );
        }
      }

      throw new Error(
        `${nativeMessage}. On mobile, try uploading an MP3/M4A file or a shorter video clip.`
      );
    }
  }

  return transcodeAudioToMp3(sourceFile, onProgress);
}
