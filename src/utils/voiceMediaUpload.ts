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
];

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
];

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
  ".opus",
  ".mp4",
];

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function isVideoMediaFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return false;
  if (file.type.startsWith("video/")) return true;
  return VIDEO_EXTENSIONS.includes(getExtension(file.name));
}

export function isAudioMediaFile(file: File): boolean {
  if (file.type.startsWith("video/")) return false;
  if (file.type.startsWith("audio/")) return true;
  return AUDIO_EXTENSIONS.includes(getExtension(file.name));
}

/** True only for video uploads that need ffmpeg audio extraction before S3 upload. */
export function needsAudioExtraction(file: File): boolean {
  if (file.type.startsWith("audio/")) return false;
  if (file.type.startsWith("video/")) return true;
  const ext = getExtension(file.name);
  if (VIDEO_ONLY_EXTENSIONS.includes(ext)) return true;
  // Ambiguous .mp4 / .webm without MIME — treat as audio-ready (recordings, audio uploads).
  return false;
}

export function isAllowedPostMediaFile(file: File): boolean {
  return isAudioMediaFile(file) || isVideoMediaFile(file);
}

export function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const useVideoElement = needsAudioExtraction(file);
    const element = document.createElement(useVideoElement ? "video" : "audio");
    element.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    element.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const duration = Math.floor(element.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Could not detect media duration"));
        return;
      }
      resolve(duration);
    };

    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read media file"));
    };

    element.src = objectUrl;
  });
}

export const POST_MEDIA_ACCEPT = "audio/*,video/*";

export const POST_MEDIA_HINT =
  "Audio or video files (MP3, WAV, MP4, MOV, etc.). Video uploads save audio only.";
