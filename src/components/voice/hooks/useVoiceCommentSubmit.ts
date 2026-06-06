import { useState } from "react";
import axios from "axios";
import Api from "@/lib/axios";

interface UseVoiceCommentSubmitOptions<T = unknown> {
  postId?: string;
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
  maxRecordingSeconds,
  onSuccess,
}: UseVoiceCommentSubmitOptions<T>) => {
  const [isSending, setIsSending] = useState(false);

  const submitComment = async ({
    text,
    recordedBlob,
    isRecording,
    stopRecording,
    recordingSeconds,
    onTooLong,
  }: SubmitArgs): Promise<T | null> => {
    if (!postId) return null;
    if (isSending) return null;

    const trimmedText = (text || "").trim();

    setIsSending(true);
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
        // Determine extension from blob type
        const fileType = blobToSend.type || "audio/webm";
        const extension = fileType.includes("ogg") ? "ogg" : "webm";
        const fileName = `voice-comment-${postId}-${Date.now()}.${extension}`;

        // Step 1: Get signed URL from voice upload endpoint
        const signedUrlRes = await Api.get("/voice/upload/signed-url", {
          params: {
            fileName,
            fileType,
            uploadType: "voice-comment",
          },
        });

        const { signedUrl, key } = signedUrlRes.data;

        // Step 2: Upload blob directly to S3
        await axios.put(signedUrl, blobToSend, {
          headers: {
            "Content-Type": fileType,
          },
        });

        audioFileURL = key; // Store the S3 key
      }

      if (!trimmedText && !audioFileURL) {
        return null;
      }

      // Step 3: Create comment with text and/or audioFileURL
      const res = await Api.post(`/voice/comment/post/${postId}`, {
        content: trimmedText,
        audioFileURL,
      });

      if (onSuccess) onSuccess(res.data.result);
      return res.data.result;
    } catch (err: unknown) {
      console.error("Failed to submit voice comment:", (err as Error)?.message);
      return null;
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, submitComment };
};

export default useVoiceCommentSubmit;
