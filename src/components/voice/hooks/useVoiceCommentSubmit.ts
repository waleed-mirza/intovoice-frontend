import { useState } from "react";
import Api from "@/lib/axios";
import { uploadFileToS3 } from "@/lib/uploadFileToS3";

interface UseVoiceCommentSubmitOptions<T = unknown> {
  postId?: string;
  tapeId?: string;
  parentId?: string | null;
  maxRecordingSeconds: number;
  onSuccess?: (comment: T) => void;
}

interface SubmitArgs {
  text: string;
  recordedBlob: Blob | null;
  isRecording: boolean;
  stopRecording: () => Promise<Blob | null>;
  recordingSeconds: number;
  onTooLong?: () => void;
}

const useVoiceCommentSubmit = <T = unknown>({
  postId,
  tapeId,
  parentId,
  maxRecordingSeconds,
  onSuccess,
}: UseVoiceCommentSubmitOptions<T>) => {
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | null>(null);

  const submitComment = async ({
    text,
    recordedBlob,
    isRecording,
    stopRecording,
    recordingSeconds,
    onTooLong,
  }: SubmitArgs): Promise<T | null> => {
    if (!postId && !tapeId) return null;
    if (isSending) return null;

    const trimmedText = (text || "").trim();
    const targetId = tapeId || postId;

    setIsSending(true);
    setUploadProgress(0);
    setUploadPhase(null);

    try {
      let blobToSend: Blob | null = recordedBlob;
      if (isRecording) {
        blobToSend = await stopRecording();
      }

      if (recordingSeconds > maxRecordingSeconds) {
        if (onTooLong) onTooLong();
        return null;
      }

      let audioFileURL: string | undefined;
      if (blobToSend) {
        const fileType = blobToSend.type || "audio/webm";
        const extension = fileType.includes("ogg") ? "ogg" : "webm";
        const fileName = `voice-comment-${targetId}-${Date.now()}.${extension}`;

        setUploadPhase("uploading");

        const key = await uploadFileToS3(
          blobToSend,
          fileName,
          fileType,
          "voice-comment",
          { onProgress: (p) => setUploadProgress(p.percent) }
        );

        audioFileURL = key;
      }

      if (!trimmedText && !audioFileURL) {
        return null;
      }

      const endpoint = tapeId
        ? `/voice/tape/${tapeId}/comments`
        : `/voice/comment/post/${postId}`;

      const res = await Api.post(endpoint, {
        content: trimmedText,
        audioFileURL,
        ...(parentId ? { parentId } : {}),
      });

      if (onSuccess) onSuccess(res.data.result);
      return res.data.result;
    } catch (err: unknown) {
      console.error("Failed to submit voice comment:", (err as Error)?.message);
      return null;
    } finally {
      setIsSending(false);
      setUploadProgress(0);
      setUploadPhase(null);
    }
  };

  return { isSending, uploadProgress, uploadPhase, submitComment };
};

export default useVoiceCommentSubmit;
