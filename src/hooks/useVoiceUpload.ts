import { useState, useCallback } from "react";
import Api from "@/lib/axios";
import { extractAudioFromVideo } from "@/utils/extractAudioFromVideo";
import { needsAudioExtraction } from "@/utils/voiceMediaUpload";

export type UploadType = "thumbnail" | "audio" | "avatar" | "banner";

interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface UploadAudioResult {
  fileUrl: string;
  duration?: number;
}

interface UseVoiceUploadReturn {
  upload: (file: File, type: UploadType) => Promise<string>;
  uploadPostMedia: (file: File) => Promise<UploadAudioResult>;
  uploading: boolean;
  extracting: boolean;
  progress: UploadProgress | null;
  error: string | null;
  reset: () => void;
}

export const useVoiceUpload = (): UseVoiceUploadReturn => {
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setExtracting(false);
    setProgress(null);
    setError(null);
  }, []);

  const upload = useCallback(async (file: File, type: UploadType): Promise<string> => {
    setUploading(true);
    setProgress({ loaded: 0, total: file.size, percent: 0 });
    setError(null);

    try {
      const signedUrlRes = await Api.get("/voice/upload/signed-url", {
        params: {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          uploadType: type,
        },
      });

      const { signedUrl, fileUrl } = signedUrlRes.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setProgress({
              loaded: event.loaded,
              total: event.total,
              percent: Math.round((event.loaded / event.total) * 100),
            });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      setProgress({ loaded: file.size, total: file.size, percent: 100 });
      setUploading(false);

      return fileUrl;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosErr.response?.data?.message || axiosErr.message || "Upload failed";
      setError(errorMessage);
      setUploading(false);
      throw new Error(errorMessage);
    }
  }, []);

  const uploadPostMedia = useCallback(
    async (file: File): Promise<UploadAudioResult> => {
      setError(null);

      try {
        let audioFile = file;
        let duration: number | undefined;

        if (needsAudioExtraction(file)) {
          setExtracting(true);
          setProgress({ loaded: 0, total: 100, percent: 0 });

          const extracted = await extractAudioFromVideo(file, (percent) => {
            setProgress({ loaded: percent, total: 100, percent });
          });

          audioFile = extracted.file;
          duration = extracted.duration;
          setExtracting(false);
        }

        const fileUrl = await upload(audioFile, "audio");
        return { fileUrl, duration };
      } catch (err: unknown) {
        const axiosErr = err as { message?: string };
        const errorMessage =
          axiosErr.message ||
          (needsAudioExtraction(file)
            ? "Failed to extract audio from video"
            : "Upload failed");
        setError(errorMessage);
        setExtracting(false);
        setUploading(false);
        throw new Error(errorMessage);
      }
    },
    [upload]
  );

  return { upload, uploadPostMedia, uploading, extracting, progress, error, reset };
};

export default useVoiceUpload;
