import { needsAudioExtraction } from "@/utils/voiceMediaUpload";

const CONVERT_WEIGHT = 0.5;

export function getAudioConversionLabel(file: File | null | undefined): string {
  if (file && needsAudioExtraction(file)) {
    return "Converting video to MP3...";
  }
  return "Converting audio to MP3...";
}

export type UploadProgressPhase = "converting" | "uploading" | null;

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export function mapConvertingProgress(phasePercent: number): number {
  return Math.round(phasePercent * CONVERT_WEIGHT);
}

export function mapUploadingProgress(
  phasePercent: number,
  afterConversion: boolean
): number {
  if (afterConversion) {
    return Math.round(CONVERT_WEIGHT * 100 + phasePercent * CONVERT_WEIGHT);
  }
  return Math.round(phasePercent);
}

export interface UploadHookSnapshot {
  uploading: boolean;
  converting: boolean;
  progress: UploadProgress | null;
  progressPhase: UploadProgressPhase;
}

export function getCombinedUploadProgress(
  thumbnail: UploadHookSnapshot,
  audio: UploadHookSnapshot,
  options: {
    hasThumbnail: boolean;
    hasAudio: boolean;
    thumbnailDone?: boolean;
    audioDone?: boolean;
    audioFile?: File | null;
  }
): { percent: number; label: string } | null {
  const { hasThumbnail, hasAudio, thumbnailDone, audioDone, audioFile } = options;
  const conversionLabel = getAudioConversionLabel(audioFile);

  const thumbBusy = thumbnail.uploading;
  const audioBusy = audio.uploading || audio.converting;

  if (!thumbBusy && !audioBusy) return null;

  const thumbPercent =
    thumbnail.progress?.percent ?? (thumbnailDone ? 100 : 0);
  const audioPercent = audio.progress?.percent ?? (audioDone ? 100 : 0);

  let percent: number;
  let label: string;

  if (hasThumbnail && hasAudio) {
    percent = Math.round((thumbPercent + audioPercent) / 2);

    if (audio.converting) {
      label = conversionLabel;
    } else if (audio.uploading) {
      label = thumbBusy ? "Uploading thumbnail and audio…" : "Uploading audio…";
    } else if (thumbBusy) {
      label = "Uploading thumbnail…";
    } else {
      label = "Uploading files…";
    }
  } else if (audioBusy) {
    percent = audioPercent;
    label = audio.converting ? conversionLabel : "Uploading audio…";
  } else {
    percent = thumbPercent;
    label = "Uploading thumbnail…";
  }

  return { percent, label };
}
