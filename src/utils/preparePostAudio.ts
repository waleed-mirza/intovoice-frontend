import { assertAudioHasSignal, assertAudioFileNonEmpty } from "@/utils/audioSignal";
import { extractAudioFromVideoNative } from "@/utils/extractAudioFromVideoNative";
import {
  isMp3File,
  transcodeAudioToMp3,
  type TranscodeAudioResult,
} from "@/utils/transcodeAudioToMp3";
import {
  getMediaDuration,
  isAllowedPostMediaFile,
  needsAudioExtraction,
} from "@/utils/voiceMediaUpload";

type ProgressCallback = (percent: number) => void;

export interface PreparePostAudioOptions {
  onProgress?: ProgressCallback;
  /** When HTML metadata is broken (e.g. MediaRecorder WebM), use this duration. */
  knownDuration?: number;
}

const MOBILE_RE = /Android|iPhone|iPad|iPod/i;
/** Soft cap for FFmpeg.wasm in-browser; larger files use native extraction when possible. */
const FFMPEG_MAX_BYTES = 200 * 1024 * 1024;

/**
 * Backend allows these MIME types for `uploadType=audio`.
 * We still convert almost everything to MP3 before upload for playback consistency;
 * only already-valid MP3 skips conversion.
 */
const BACKEND_AUDIO_TYPES = new Set([
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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isMobileClient(): boolean {
  return typeof navigator !== "undefined" && MOBILE_RE.test(navigator.userAgent);
}

function shouldTryFfmpeg(file: File): boolean {
  if (isMobileClient()) return false;
  return file.size > 0 && file.size <= FFMPEG_MAX_BYTES;
}

/**
 * True only for files that are already MP3 and can go straight to S3.
 * All other audio/video must be prepared (converted / extracted) first.
 */
export function canUploadAudioDirectly(file: File): boolean {
  if (needsAudioExtraction(file)) return false;
  return isMp3File(file);
}

export function isBackendAcceptedAudioMime(file: File): boolean {
  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (BACKEND_AUDIO_TYPES.has(baseType)) return true;
  return isMp3File(file);
}

async function finalizePreparedAudio(
  result: TranscodeAudioResult,
  options?: { requireDecodable?: boolean; knownDuration?: number }
): Promise<TranscodeAudioResult> {
  assertAudioFileNonEmpty(result.file, "Prepared audio");
  await assertAudioHasSignal(result.file, {
    requireDecodable: options?.requireDecodable ?? isMp3File(result.file),
    label: "Prepared audio",
  });

  let duration = result.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    try {
      duration = await getMediaDuration(result.file);
    } catch {
      if (
        typeof options?.knownDuration === "number" &&
        Number.isFinite(options.knownDuration) &&
        options.knownDuration > 0
      ) {
        duration = Math.floor(options.knownDuration);
      }
    }
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Prepared audio has no duration");
  }

  if (!isBackendAcceptedAudioMime(result.file)) {
    throw new Error("Prepared audio format is not accepted for upload");
  }

  return { file: result.file, duration };
}

async function convertWithFfmpeg(
  sourceFile: File,
  onProgress?: ProgressCallback
): Promise<TranscodeAudioResult> {
  onProgress?.(0);
  const converted = await transcodeAudioToMp3(sourceFile, onProgress);
  return finalizePreparedAudio(converted, { requireDecodable: true });
}

async function extractThenNormalize(
  sourceFile: File,
  onProgress?: ProgressCallback
): Promise<TranscodeAudioResult> {
  onProgress?.(0);
  const extracted = await extractAudioFromVideoNative(sourceFile, (p) => {
    // Leave headroom for optional MP3 normalize step.
    onProgress?.(Math.min(90, Math.round(p * 0.9)));
  });

  // Prefer uploading MP3 when FFmpeg is available (desktop).
  if (shouldTryFfmpeg(extracted.file) && !isMp3File(extracted.file)) {
    try {
      const mp3 = await transcodeAudioToMp3(extracted.file, (p) => {
        onProgress?.(Math.min(99, 90 + Math.round(p * 0.1)));
      });
      return finalizePreparedAudio(mp3, { requireDecodable: true });
    } catch {
      // Fall through — extracted webm/m4a is still backend-accepted.
    }
  }

  onProgress?.(100);
  return finalizePreparedAudio(
    { file: extracted.file, duration: extracted.duration },
    { requireDecodable: true }
  );
}

/**
 * Normalize any allowed post/tape media into an upload-ready audio file.
 *
 * Contract:
 * - Valid MP3 → validate signal + duration, upload as-is
 * - Other audio → FFmpeg → MP3 (desktop); on mobile try FFmpeg only if not blocked,
 *   otherwise fail with a clear message (mobile skips heavy WASM by default)
 * - Video → FFmpeg demux→MP3 on desktop; native extract (+ optional MP3) on mobile / FFmpeg fail
 * - Never returns silent or empty audio
 */
export async function preparePostAudioForUpload(
  sourceFile: File,
  onProgressOrOptions?: ProgressCallback | PreparePostAudioOptions
): Promise<TranscodeAudioResult> {
  const options: PreparePostAudioOptions =
    typeof onProgressOrOptions === "function"
      ? { onProgress: onProgressOrOptions }
      : onProgressOrOptions ?? {};
  const onProgress = options.onProgress;
  const knownDuration =
    typeof options.knownDuration === "number" &&
    Number.isFinite(options.knownDuration) &&
    options.knownDuration > 0
      ? Math.floor(options.knownDuration)
      : undefined;

  if (!sourceFile || sourceFile.size <= 0) {
    throw new Error("Please select a non-empty audio or video file");
  }
  if (!isAllowedPostMediaFile(sourceFile)) {
    throw new Error("Please select a supported audio or video file");
  }

  // Already MP3 — validate and upload directly.
  if (canUploadAudioDirectly(sourceFile)) {
    await assertAudioHasSignal(sourceFile, { requireDecodable: true, label: "MP3 file" });
    let duration = knownDuration ?? 0;
    try {
      duration = await getMediaDuration(sourceFile);
    } catch {
      if (!duration) throw new Error("Could not detect media duration");
    }
    onProgress?.(100);
    return { file: sourceFile, duration };
  }

  const errors: string[] = [];

  // --- Video sources ---
  if (needsAudioExtraction(sourceFile)) {
    if (shouldTryFfmpeg(sourceFile)) {
      try {
        return await convertWithFfmpeg(sourceFile, onProgress);
      } catch (ffmpegError) {
        errors.push(toErrorMessage(ffmpegError, "Browser conversion failed"));
        try {
          return await extractThenNormalize(sourceFile, onProgress);
        } catch (nativeError) {
          errors.push(toErrorMessage(nativeError, "Video audio extraction failed"));
          throw new Error(errors.join(". "));
        }
      }
    }

    // Mobile / oversized: native extraction first, then optional MP3 if FFmpeg allowed.
    try {
      return await extractThenNormalize(sourceFile, onProgress);
    } catch (nativeError) {
      // Last resort: try FFmpeg even on mobile for smaller clips.
      if (sourceFile.size <= FFMPEG_MAX_BYTES) {
        try {
          return await convertWithFfmpeg(sourceFile, onProgress);
        } catch (ffmpegError) {
          throw new Error(
            `${toErrorMessage(nativeError, "Video audio extraction failed")}. ${toErrorMessage(
              ffmpegError,
              "Browser conversion also failed"
            )}. Try an MP3/M4A file or a shorter clip.`
          );
        }
      }
      throw new Error(
        `${toErrorMessage(nativeError, "Video audio extraction failed")}. On mobile, try uploading an MP3/M4A file or a shorter video clip.`
      );
    }
  }

  // --- Non-MP3 audio (wav, webm recording, m4a, flac, etc.) ---
  if (shouldTryFfmpeg(sourceFile)) {
    try {
      return await convertWithFfmpeg(sourceFile, onProgress);
    } catch (ffmpegError) {
      errors.push(toErrorMessage(ffmpegError, "Could not convert audio to MP3"));
    }
  } else if (!isMobileClient() && sourceFile.size > FFMPEG_MAX_BYTES) {
    throw new Error(
      "This audio file is too large to convert in the browser. Please upload an MP3 under 200MB, or a smaller file."
    );
  }

  // Mobile recordings / trimmed clips / FFmpeg failures: upload accepted MIME as-is.
  if (isBackendAcceptedAudioMime(sourceFile)) {
    try {
      await assertAudioHasSignal(sourceFile, {
        requireDecodable: false,
        label: "Audio file",
      });
      let duration = knownDuration ?? 0;
      try {
        const detected = await getMediaDuration(sourceFile);
        if (Number.isFinite(detected) && detected > 0) duration = detected;
      } catch {
        // keep knownDuration
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Could not detect media duration");
      }
      onProgress?.(100);
      return finalizePreparedAudio(
        { file: sourceFile, duration },
        { requireDecodable: false, knownDuration }
      );
    } catch (directError) {
      errors.push(toErrorMessage(directError, "Audio file could not be validated"));
    }
  }

  // Mobile last resort: attempt FFmpeg for smaller non-MP3 audio.
  if (isMobileClient() && sourceFile.size <= FFMPEG_MAX_BYTES) {
    try {
      return await convertWithFfmpeg(sourceFile, onProgress);
    } catch (ffmpegError) {
      errors.push(toErrorMessage(ffmpegError, "Browser conversion failed"));
    }
  }

  throw new Error(
    errors.filter(Boolean).join(". ") ||
      "Could not prepare this audio for upload. Try an MP3 file."
  );
}
