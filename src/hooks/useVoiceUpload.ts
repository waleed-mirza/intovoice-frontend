import { useState, useCallback } from "react";
import Api from "@/lib/axios";

export type UploadType = "thumbnail" | "audio" | "avatar" | "banner";

interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface UseVoiceUploadReturn {
  upload: (file: File, type: UploadType) => Promise<string>;
  uploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  reset: () => void;
}

export const useVoiceUpload = (): UseVoiceUploadReturn => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(null);
    setError(null);
  }, []);

  const upload = useCallback(async (file: File, type: UploadType): Promise<string> => {
    setUploading(true);
    setProgress({ loaded: 0, total: file.size, percent: 0 });
    setError(null);

    try {
      // Step 1: Get signed URL from backend
      const signedUrlRes = await Api.get("/voice/upload/signed-url", {
        params: {
          fileName: file.name,
          fileType: file.type,
          uploadType: type,
        },
      });

      const { signedUrl, fileUrl } = signedUrlRes.data;

      // Step 2: Upload file directly to S3 using signed URL
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
        xhr.setRequestHeader("Content-Type", file.type);
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

  return { upload, uploading, progress, error, reset };
};

export default useVoiceUpload;
