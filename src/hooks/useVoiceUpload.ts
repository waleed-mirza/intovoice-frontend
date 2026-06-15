import { useState, useCallback } from "react";
import { uploadFileToS3 } from "@/lib/uploadFileToS3";
import {
  canUploadAudioDirectly,
  preparePostAudioForUpload,
} from "@/utils/preparePostAudio";
import { mapConvertingProgress, mapUploadingProgress } from "@/utils/uploadProgress";
import type { UploadProgress, UploadProgressPhase } from "@/utils/uploadProgress";

export type UploadType = "thumbnail" | "audio" | "avatar" | "banner";

export type { UploadProgress, UploadProgressPhase } from "@/utils/uploadProgress";

export interface UploadAudioResult {
  assetKey: string;
  duration?: number;
}

interface UseVoiceUploadReturn {
  upload: (
    file: File,
    type: UploadType,
    options?: { overallAfterConversion?: boolean; replaceKey?: string | null }
  ) => Promise<string>;
  uploadPostMedia: (
    file: File,
    options?: { replaceKey?: string | null }
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
      options?: { replaceKey?: string | null }
    ): Promise<UploadAudioResult> => {
      setError(null);

      try {
        let audioFile = file;
        let duration: number | undefined;
        const needsConversion = !canUploadAudioDirectly(file);

        if (needsConversion) {
          setConverting(true);
          setProgressPhase("converting");
          setProgress({ loaded: 0, total: 100, percent: 0 });

          const converted = await preparePostAudioForUpload(file, (phasePercent) => {
            setProgress({
              loaded: phasePercent,
              total: 100,
              percent: mapConvertingProgress(phasePercent),
            });
          });

          audioFile = converted.file;
          duration = converted.duration;
          setConverting(false);
          setProgress({
            loaded: 100,
            total: 100,
            percent: mapConvertingProgress(100),
          });
        }

        const assetKey = await upload(audioFile, "audio", {
          overallAfterConversion: needsConversion,
          replaceKey: options?.replaceKey,
        });

        return { assetKey, duration };
      } catch (err: unknown) {
        const axiosErr = err as { message?: string };
        const errorMessage =
          axiosErr.message ||
          (!canUploadAudioDirectly(file)
            ? "Failed to prepare audio for upload"
            : "Upload failed");
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
