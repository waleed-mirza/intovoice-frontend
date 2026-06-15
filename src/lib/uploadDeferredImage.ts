import { uploadFileToS3 } from "@/lib/uploadFileToS3";

export interface DeferredImageState {
  pendingFile: File | null;
  committedKey: string;
  removed: boolean;
}

export interface ResolvedDeferredImage {
  /** Key to persist, or `null` when the user removed the asset. */
  key: string | null | undefined;
  /** Newly uploaded keys (for rollback on failed save). */
  uploadedKeys: string[];
}

export async function resolveDeferredImageKey(
  state: DeferredImageState,
  uploadType: "avatar" | "banner",
  onProgress?: (percent: number) => void
): Promise<ResolvedDeferredImage> {
  if (state.removed) {
    return { key: null, uploadedKeys: [] };
  }

  if (state.pendingFile) {
    const key = await uploadFileToS3(
      state.pendingFile,
      state.pendingFile.name,
      state.pendingFile.type || "image/jpeg",
      uploadType,
      {
        replaceKey: state.committedKey || null,
        onProgress: onProgress ? (p) => onProgress(p.percent) : undefined,
      }
    );
    return { key, uploadedKeys: [key] };
  }

  return {
    key: state.committedKey || undefined,
    uploadedKeys: [],
  };
}
