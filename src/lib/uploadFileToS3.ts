import Api from "@/lib/axios";

export type VoiceUploadType =
  | "thumbnail"
  | "audio"
  | "avatar"
  | "banner"
  | "voice-comment";

export interface S3UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadFileToS3Options {
  replaceKey?: string | null;
  onProgress?: (progress: S3UploadProgress) => void;
}

export async function uploadFileToS3(
  file: File | Blob,
  fileName: string,
  fileType: string,
  uploadType: VoiceUploadType,
  options?: UploadFileToS3Options
): Promise<string> {
  const onProgress = options?.onProgress;

  const signedUrlRes = await Api.get("/voice/upload/signed-url", {
    params: {
      fileName,
      fileType,
      uploadType,
      ...(options?.replaceKey ? { replaceKey: options.replaceKey } : {}),
    },
  });

  const { signedUrl, key } = signedUrlRes.data as {
    signedUrl: string;
    key: string;
  };

  const total = file.size;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
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
    xhr.setRequestHeader("Content-Type", fileType || "application/octet-stream");
    xhr.send(file);
  });

  onProgress?.({ loaded: total, total, percent: 100 });

  return key;
}

/** Delete uploaded keys when a create/save fails after S3 PUT. */
export async function releaseUploadedAssets(keys: (string | null | undefined)[]): Promise<void> {
  const unique = Array.from(new Set(keys.filter(Boolean) as string[]));
  await Promise.all(
    unique.map(async (key) => {
      try {
        await Api.delete("/voice/upload/asset", { params: { key } });
      } catch {
        // Best-effort rollback
      }
    })
  );
}
