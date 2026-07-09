import { useState, useCallback } from "react";
import { uploadFileToS3 } from "@/lib/uploadFileToS3";
import { preparePostAudioForUpload } from "@/utils/preparePostAudio";
import { mapConvertingProgress, mapUploadingProgress } from "@/utils/uploadProgress";
import type { UploadProgress, UploadProgressPhase } from "@/utils/uploadProgress";
import { needsAudioExtraction } from "@/utils/voiceMediaUpload";
import { isMp3File } from "@/utils/transcodeAudioToMp3";

export type UploadType = "thumbnail" | "audio" | "avatar" | "banner";

export type { UploadProgress, UploadProgressPhase } from "@/utils/uploadProgress";

export interface UploadAudioResult {
  assetKey: string;
  duration: number;
}

interface UseVoiceUploadReturn {
  upload: (
    file: File,
    type: UploadType,
    options?: { overallAfterConversion?: boolean; replaceKey?: string | null }
  ) => Promise<string>;
  uploadPostMedia: (
    file: File,
    options?: { replaceKey?: string | null; knownDuration?: number }
  ) => Promise<UploadAudioResult>;
  uploading: boolean;
  converting: boolean;
  /** @deprecated Use converting */
  extracting: boolean;
  progress: UploadProgress | null;
  progressPhase: UploadProgressPhase;
  error: string | null;
  reset: () => void;
}

export const useVoiceUpload = (): UseVoiceUploadReturn => {
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [progressPhase, setProgressPhase] = useState<UploadProgressPhase>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setConverting(false);
    setProgress(null);
    setProgressPhase(null);
    setError(null);
  }, []);

  const upload = useCallback(
    async (
      file: File,
      type: UploadType,
      options?: { overallAfterConversion?: boolean; replaceKey?: string | null }
    ): Promise<string> => {
      setUploading(true);
      setProgressPhase("uploading");
      setProgress({ loaded: 0, total: file.size, percent: 0 });
      setError(null);

      const afterConversion = options?.overallAfterConversion ?? false;

      try {
        if (!file.size || file.size < 256) {
          throw new Error("Audio file is empty — conversion may have failed");
        }

        const key = await uploadFileToS3(
          file,
          file.name,
          file.type || "application/octet-stream",
          type,
          {
            replaceKey: options?.replaceKey,
            onProgress: (p) => {
              setProgress({
                loaded: p.loaded,
                total: p.total,
                percent: mapUploadingProgress(p.percent, afterConversion),
              });
            },
          }
        );

        setProgress({
          loaded: file.size,
          total: file.size,
          percent: mapUploadingProgress(100, afterConversion),
        });
        setUploading(false);
        setProgressPhase(null);

        return key;
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMessage =
          axiosErr.response?.data?.message || axiosErr.message || "Upload failed";
        setError(errorMessage);
        setUploading(false);
        setProgressPhase(null);
        throw new Error(errorMessage);
      }
    },
    []
  );

  const uploadPostMedia = useCallback(
    async (
      file: File,
      options?: { replaceKey?: string | null; knownDuration?: number }
    ): Promise<UploadAudioResult> => {
      setError(null);

      // Always run preparePostAudioForUpload (validates MP3; converts everything else).
      // Never upload raw video or unvalidated blobs.
      const showConversionUi = !isMp3File(file) || needsAudioExtraction(file);

      try {
        if (showConversionUi) {
          setConverting(true);
          setProgressPhase("converting");
          setProgress({ loaded: 0, total: 100, percent: 0 });
        } else {
          setProgressPhase("converting");
          setProgress({ loaded: 0, total: 100, percent: 0 });
        }

        const prepared = await preparePostAudioForUpload(file, {
          knownDuration: options?.knownDuration,
          onProgress: (phasePercent) => {
            setProgress({
              loaded: phasePercent,
              total: 100,
              percent: mapConvertingProgress(phasePercent),
            });
          },
        });

        if (!prepared.file.size || prepared.file.size < 256) {
          throw new Error("Prepared audio was empty");
        }
        if (!Number.isFinite(prepared.duration) || prepared.duration <= 0) {
          throw new Error("Prepared audio has no duration");
        }

        setConverting(false);
        setProgress({
          loaded: 100,
          total: 100,
          percent: mapConvertingProgress(100),
        });

        const assetKey = await upload(prepared.file, "audio", {
          overallAfterConversion: showConversionUi,
          replaceKey: options?.replaceKey,
        });

        return { assetKey, duration: prepared.duration };
      } catch (err: unknown) {
        const axiosErr = err as { message?: string };
        const errorMessage = axiosErr.message || "Failed to prepare audio for upload";
        setError(errorMessage);
        setConverting(false);
        setUploading(false);
        setProgressPhase(null);
        throw new Error(errorMessage);
      }
    },
    [upload]
  );

  return {
    upload,
    uploadPostMedia,
    uploading,
    converting,
    extracting: converting,
    progress,
    progressPhase,
    error,
    reset,
  };
};

export default useVoiceUpload;
