const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".m4v",
  ".mpeg",
  ".mpg",
  ".ogv",
  ".3gp",
  ".3gpp",
  ".webm",
  ".wmv",
  ".flv",
  ".ts",
  ".mts",
  ".m2ts",
];

/** Extensions that are always video (never treated as audio-only containers). */
const VIDEO_ONLY_EXTENSIONS = [
  ".mov",
  ".avi",
  ".mkv",
  ".m4v",
  ".mpeg",
  ".mpg",
  ".ogv",
  ".3gp",
  ".3gpp",
  ".wmv",
  ".flv",
  ".ts",
  ".mts",
  ".m2ts",
];

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
  ".opus",
  ".mp4",
  ".aiff",
  ".aif",
  ".wma",
  ".caf",
];

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function getMediaExtension(fileName: string): string {
  return getExtension(fileName);
}

export function getBaseMimeType(file: File | Blob & { type?: string; name?: string }): string {
  return ((file.type || "").split(";")[0] || "").trim().toLowerCase();
}

export function isVideoMediaFile(file: File): boolean {
  const mime = getBaseMimeType(file);
  if (mime.startsWith("audio/")) return false;
  if (mime.startsWith("video/")) return true;
  return VIDEO_EXTENSIONS.includes(getExtension(file.name));
}

export function isAudioMediaFile(file: File): boolean {
  const mime = getBaseMimeType(file);
  if (mime.startsWith("video/")) return false;
  if (mime.startsWith("audio/")) return true;
  return AUDIO_EXTENSIONS.includes(getExtension(file.name));
}

/**
 * True when the source must be demuxed/transcoded before upload
 * (video containers, or ambiguous video-only extensions).
 */
export function needsAudioExtraction(file: File): boolean {
  const mime = getBaseMimeType(file);
  if (mime.startsWith("audio/")) return false;
  if (mime.startsWith("video/")) return true;
  const ext = getExtension(file.name);
  if (VIDEO_ONLY_EXTENSIONS.includes(ext)) return true;
  // Ambiguous .mp4 / .webm without MIME — treat as audio-ready (recordings, audio uploads).
  // preparePostAudio still normalizes non-MP3 to MP3.
  return false;
}

export function isAllowedPostMediaFile(file: File): boolean {
  if (!file || file.size <= 0) return false;
  return isAudioMediaFile(file) || isVideoMediaFile(file);
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/** Decode via Web Audio — works when HTMLMediaElement reports Infinity (common for MediaRecorder WebM). */
async function getDurationViaWebAudio(file: File): Promise<number> {
  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx) throw new Error("Could not detect media duration");

  const context = new AudioCtx();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const duration = Math.floor(buffer.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not detect media duration");
    }
    return duration;
  } finally {
    if (context.state !== "closed") {
      await context.close().catch(() => undefined);
    }
  }
}

/**
 * Prefer video element for video sources; fall back to the other element type
 * when metadata cannot be read (common for odd MIME / extension mismatches).
 * MediaRecorder WebM often reports Infinity — seek trick + Web Audio fallback.
 */
export function getMediaDuration(file: File): Promise<number> {
  const preferVideo = needsAudioExtraction(file) || isVideoMediaFile(file);

  const tryElement = (tag: "audio" | "video"): Promise<number> =>
    new Promise((resolve, reject) => {
      const element = document.createElement(tag);
      element.preload = "metadata";
      const objectUrl = URL.createObjectURL(file);
      let settled = false;

      const cleanup = () => {
        element.onloadedmetadata = null;
        element.onerror = null;
        element.onseeked = null;
        element.removeAttribute("src");
        element.load();
        URL.revokeObjectURL(objectUrl);
      };

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const acceptDuration = (raw: number) => {
        const duration = Math.floor(raw);
        if (!Number.isFinite(duration) || duration <= 0) {
          finish(() => reject(new Error("Could not detect media duration")));
          return;
        }
        finish(() => resolve(duration));
      };

      element.onloadedmetadata = () => {
        const raw = element.duration;
        // Chrome MediaRecorder WebM often reports Infinity until a seek forces decode.
        if (!Number.isFinite(raw) || raw === Infinity) {
          element.onseeked = () => {
            const afterSeek = element.duration;
            if (!Number.isFinite(afterSeek) || afterSeek === Infinity || afterSeek <= 0) {
              finish(() => reject(new Error("Could not detect media duration")));
              return;
            }
            acceptDuration(afterSeek);
          };
          try {
            element.currentTime = 1e101;
          } catch {
            finish(() => reject(new Error("Could not detect media duration")));
          }
          // If seek never fires, reject so Web Audio fallback can run.
          setTimeout(() => {
            if (!settled) {
              finish(() => reject(new Error("Could not detect media duration")));
            }
          }, 2500);
          return;
        }
        acceptDuration(raw);
      };

      element.onerror = () => {
        finish(() => reject(new Error("Could not read media file")));
      };

      element.src = objectUrl;
    });

  const primary = preferVideo ? "video" : "audio";
  const secondary = preferVideo ? "audio" : "video";

  return tryElement(primary)
    .catch(() => tryElement(secondary))
    .catch(() => getDurationViaWebAudio(file));
}

export const POST_MEDIA_ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.opus,.webm,.mp4,.mov,.mkv,.avi,.m4v,.3gp,.caf,.aiff,.aif";

export const POST_MEDIA_HINT =
  "Audio or video (MP3, WAV, M4A, MP4, MOV, WebM, etc.). Everything is converted to MP3 before upload.";
