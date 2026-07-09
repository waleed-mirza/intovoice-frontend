"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { useVoiceUpload } from "@/hooks/useVoiceUpload";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import {
  TAPE_THUMBNAIL_ASPECT,
  TAPE_THUMBNAIL_SIZE_LABEL,
  formatDuration,
} from "@/utils/voiceHelpers";
import {
  getMediaDuration,
  isAllowedPostMediaFile,
  POST_MEDIA_ACCEPT,
  POST_MEDIA_HINT,
} from "@/utils/voiceMediaUpload";
import { TAPE_FORM_PAGE } from "@/utils/tapeLayout";
import { releaseUploadedAssets } from "@/lib/uploadFileToS3";
import UploadProgressBar from "@/components/voice/UploadProgressBar";
import { getCombinedUploadProgress, getAudioConversionLabel } from "@/utils/uploadProgress";
import ThumbnailPicker from "@/components/voice/ThumbnailPicker";
import AudioTrimModal from "@/components/voice/AudioTrimModal";
import {
  Loader2,
  Upload,
  Mic,
  Trash2,
  AlertCircle,
  User,
  Scissors,
} from "@/components/voice/VoiceIcons";

interface Station {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string;
}

const MAX_DURATION = 59;
const MAX_AUDIO_SIZE = 100 * 1024 * 1024;

type AudioSource = "upload" | "record";
type CreatorMode = "myself" | "station";
type FieldErrorKey = "station" | "caption" | "thumbnail" | "audio" | "form";

type FieldErrors = Partial<Record<FieldErrorKey, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

export default function TapeUploadPage() {
  const router = useRouter();
  const { user, userLoading } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const stationFieldRef = useRef<HTMLDivElement>(null);
  const captionFieldRef = useRef<HTMLDivElement>(null);
  const thumbnailFieldRef = useRef<HTMLDivElement>(null);
  const audioFieldRef = useRef<HTMLDivElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  const [stations, setStations] = useState<Station[]>([]);
  const [creatorMode, setCreatorMode] = useState<CreatorMode>("myself");
  const [selectedStation, setSelectedStation] = useState("");
  const [caption, setCaption] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [audioURL, setAudioURL] = useState("");
  const [audioSource, setAudioSource] = useState<AudioSource>("record");
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimSourceFile, setTrimSourceFile] = useState<File | null>(null);
  const [trimSourceDuration, setTrimSourceDuration] = useState(0);

  const thumbnailUpload = useVoiceUpload();
  const audioUpload = useVoiceUpload();

  const clearFieldError = (key: FieldErrorKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const showFieldError = (key: FieldErrorKey, message: string) => {
    setFieldErrors({ [key]: message });
  };

  useEffect(() => {
    const key = (Object.keys(fieldErrors)[0] as FieldErrorKey | undefined) ?? null;
    if (!key) return;
    const target =
      key === "station"
        ? stationFieldRef.current
        : key === "caption"
          ? captionFieldRef.current
          : key === "thumbnail"
            ? thumbnailFieldRef.current
            : key === "audio"
              ? audioFieldRef.current
              : formErrorRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  const {
    isRecording,
    recordingSeconds,
    recordedBlob,
    recordedPreviewUrl,
    startRecording,
    stopRecording,
    resetAudioState,
    formatSeconds,
  } = useVoiceRecorder({
    maxSeconds: MAX_DURATION,
    onPermissionDenied: () =>
      showFieldError("audio", "Microphone access is required to record audio"),
  });

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/tapes/upload");
      return;
    }
    Api.get("/voice/station/my-stations")
      .then((res) => setStations(res.data.result || []))
      .catch(() => setStations([]))
      .finally(() => setLoading(false));
  }, [user, userLoading, router]);

  const handleThumbnailSelect = (file: File, previewUrl: string) => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setThumbnailFile(file);
    setThumbnailURL("");
    clearFieldError("thumbnail");
  };

  const openTrimModal = (file: File, mediaDuration: number) => {
    setTrimSourceFile(file);
    setTrimSourceDuration(mediaDuration);
    setTrimModalOpen(true);
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_AUDIO_SIZE) {
      showFieldError("audio", "File must be less than 100MB");
      return;
    }
    if (!isAllowedPostMediaFile(file)) {
      showFieldError("audio", "Please select an audio or video file");
      return;
    }

    setAudioURL("");
    setDuration(0);
    clearFieldError("audio");

    try {
      const mediaDuration = await getMediaDuration(file);
      if (mediaDuration > MAX_DURATION) {
        setAudioFile(null);
        setUploadPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return "";
        });
        openTrimModal(file, mediaDuration);
        return;
      }
      setAudioFile(file);
      setUploadPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setDuration(mediaDuration);
    } catch {
      showFieldError(
        "audio",
        "Could not read this file. Please try a different audio file."
      );
      setAudioFile(null);
      setUploadPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    }
  };

  const handleTrimComplete = async (trimmedFile: File, trimmedDuration: number) => {
    setAudioFile(trimmedFile);
    setUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(trimmedFile);
    });
    setAudioURL("");
    setDuration(trimmedDuration);
    clearFieldError("audio");
    setTrimSourceFile(null);
    setTrimSourceDuration(0);
  };

  const handleTrimClose = () => {
    setTrimModalOpen(false);
    setTrimSourceFile(null);
    setTrimSourceDuration(0);
  };

  const clearThumbnail = () => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setThumbnailFile(null);
    setThumbnailURL("");
    thumbnailUpload.reset();
    clearFieldError("thumbnail");
  };

  const clearAudio = () => {
    setAudioFile(null);
    setUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setAudioURL("");
    setDuration(0);
    audioUpload.reset();
    resetAudioState();
    clearFieldError("audio");
  };

  useEffect(() => {
    if (!recordedBlob || audioSource !== "record") return;
    const file = new File([recordedBlob], `tape-${Date.now()}.webm`, {
      type: recordedBlob.type.startsWith("audio/") ? recordedBlob.type : "audio/webm",
    });
    setAudioFile(file);
    const seconds = Math.max(1, Math.min(recordingSeconds, MAX_DURATION));
    setDuration(seconds);
    clearFieldError("audio");
  }, [recordedBlob, audioSource, recordingSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caption.trim()) {
      showFieldError("caption", "Caption is required");
      return;
    }
    if (caption.trim().length > 500) {
      showFieldError("caption", "Caption must be 500 characters or fewer");
      return;
    }
    if (!thumbnailFile && !thumbnailURL) {
      showFieldError("thumbnail", "Thumbnail is required");
      return;
    }

    let publishAudioFile = audioFile;
    let publishDuration = duration;

    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) {
        showFieldError(
          "audio",
          "Could not save your recording. Try recording again."
        );
        return;
      }
      publishAudioFile = new File([blob], `tape-${Date.now()}.webm`, {
        type: blob.type.startsWith("audio/") ? blob.type : "audio/webm",
      });
    }

    if (!publishAudioFile && !audioURL) {
      showFieldError("audio", "Audio is required");
      return;
    }

    if (publishAudioFile) {
      try {
        const detected = await getMediaDuration(publishAudioFile);
        if (detected > MAX_DURATION) {
          openTrimModal(publishAudioFile, detected);
          return;
        }
        publishDuration = Math.floor(detected);
      } catch {
        if (publishDuration <= 0) {
          showFieldError(
            "audio",
            "Could not detect audio duration. Try re-uploading or re-recording."
          );
          return;
        }
        publishDuration = Math.floor(publishDuration);
      }
    } else {
      publishDuration = Math.floor(publishDuration);
    }

    if (publishDuration <= 0 || publishDuration > MAX_DURATION) {
      if (publishAudioFile && publishDuration > MAX_DURATION) {
        openTrimModal(publishAudioFile, publishDuration);
        return;
      }
      showFieldError(
        "audio",
        `Audio must be between 1 and ${MAX_DURATION} seconds`
      );
      return;
    }
    if (creatorMode === "station" && !selectedStation) {
      showFieldError("station", "Please select a station");
      return;
    }

    const uploadedKeys: string[] = [];
    try {
      setPublishing(true);
      setFieldErrors({});

      let finalThumbnailURL = thumbnailURL;
      let finalAudioURL = audioURL;

      if (thumbnailFile && !thumbnailURL) {
        finalThumbnailURL = await thumbnailUpload.upload(thumbnailFile, "thumbnail");
        uploadedKeys.push(finalThumbnailURL);
      }

      let finalDuration = publishDuration;
      if (publishAudioFile && !audioURL) {
        const uploadResult = await audioUpload.uploadPostMedia(publishAudioFile, {
          knownDuration: publishDuration,
        });
        finalAudioURL = uploadResult.assetKey;
        uploadedKeys.push(finalAudioURL);
        if (uploadResult.duration && uploadResult.duration > 0) {
          finalDuration = Math.min(Math.floor(uploadResult.duration), MAX_DURATION);
        }
      }

      if (!finalThumbnailURL || !finalAudioURL) {
        showFieldError("form", "Upload did not complete. Please try again.");
        return;
      }

      const res = await Api.post("/voice/tape", {
        caption: caption.trim(),
        thumbnailURL: finalThumbnailURL,
        audioURL: finalAudioURL,
        duration: finalDuration,
        stationId: creatorMode === "station" ? selectedStation : null,
      });

      router.push(`/tapes/${res.data.result.id}`);
    } catch (err: unknown) {
      await releaseUploadedAssets(uploadedKeys);
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      if (axiosErr.response?.status === 401) {
        router.push("/auth/login?redirect=/tapes/upload");
        return;
      }
      const message =
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        "Failed to publish tape";
      showFieldError("form", message);
    } finally {
      setPublishing(false);
    }
  };

  const handleStartRecording = async () => {
    clearFieldError("audio");
    if (audioFile) clearAudio();
    await startRecording();
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const isUploading = thumbnailUpload.uploading || audioUpload.uploading;
  const isConverting = audioUpload.converting;
  const isBusy =
    publishing || isUploading || isConverting;

  const uploadProgress = getCombinedUploadProgress(
    {
      uploading: thumbnailUpload.uploading,
      converting: false,
      progress: thumbnailUpload.progress,
      progressPhase: thumbnailUpload.progressPhase,
    },
    {
      uploading: audioUpload.uploading,
      converting: audioUpload.converting,
      progress: audioUpload.progress,
      progressPhase: audioUpload.progressPhase,
    },
    {
      hasThumbnail: Boolean(thumbnailFile || thumbnailURL),
      hasAudio: Boolean(audioFile || audioURL),
      thumbnailDone: Boolean(thumbnailURL),
      audioDone: Boolean(audioURL),
      audioFile,
    }
  );

  const conversionLabel = getAudioConversionLabel(audioFile);

  return (
    <div className={TAPE_FORM_PAGE}>
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Create a tape</h1>
        <p className="text-gray-500 text-sm mt-1">
          Short audio clips up to {MAX_DURATION} seconds
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div ref={stationFieldRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post as
          </label>
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={() => {
                setCreatorMode("myself");
                clearFieldError("station");
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${
                creatorMode === "myself"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <User className="w-4 h-4" />
              Myself
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("station")}
              disabled={stations.length === 0}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 ${
                creatorMode === "station"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Station
            </button>
          </div>
          {creatorMode === "station" && (
            <select
              value={selectedStation}
              onChange={(e) => {
                setSelectedStation(e.target.value);
                clearFieldError("station");
              }}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                fieldErrors.station
                  ? "border-red-300 focus:ring-red-300"
                  : "border-gray-200"
              }`}
              required
            >
              <option value="">Select a station</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (@{s.handle})
                </option>
              ))}
            </select>
          )}
          <FieldError message={fieldErrors.station} />
        </div>

        <div ref={captionFieldRef}>
          <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-2">
            Caption
          </label>
          <textarea
            id="caption"
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              clearFieldError("caption");
            }}
            maxLength={500}
            rows={3}
            placeholder="What's this tape about?"
            className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none ${
              fieldErrors.caption
                ? "border-red-300 focus:ring-red-300"
                : "border-gray-200"
            }`}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{caption.length}/500</p>
          <FieldError message={fieldErrors.caption} />
        </div>

        <div ref={thumbnailFieldRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thumbnail <span className="text-red-500">*</span>
          </label>
          <div className="mx-auto h-[min(45vh,28rem)] max-h-[50vh] min-h-[180px] sm:min-h-[200px] aspect-[9/16] w-auto">
            <ThumbnailPicker
              previewUrl={thumbnailPreview}
              onSelect={handleThumbnailSelect}
              onClear={clearThumbnail}
              onValidationError={(message) => showFieldError("thumbnail", message)}
              aspect={TAPE_THUMBNAIL_ASPECT}
              aspectClassName="h-full w-full"
              className="h-full w-full"
              sizeLabel={TAPE_THUMBNAIL_SIZE_LABEL}
              ratioLabel="9:16"
              emptyLabel="Click to upload vertical thumbnail"
            />
          </div>
          <FieldError message={fieldErrors.thumbnail} />
        </div>

        <div ref={audioFieldRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Audio <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-3">
            {(["record", "upload"] as AudioSource[]).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => {
                  if (isRecording) return;
                  clearAudio();
                  setAudioSource(src);
                }}
                disabled={isRecording}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  audioSource === src
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {src === "record" ? "Record" : "Upload file"}
              </button>
            ))}
          </div>

          {audioSource === "record" ? (
            <div
              className={`rounded-xl border p-4 ${
                fieldErrors.audio
                  ? "border-red-300 bg-red-50/40"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              {isRecording ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                      </span>
                      <span className="font-medium text-gray-900">Recording...</span>
                    </div>
                    <span className="text-sm font-mono tabular-nums text-gray-700">
                      {formatSeconds(recordingSeconds)} / {formatSeconds(MAX_DURATION)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (recordingSeconds / MAX_DURATION) * 100)}%`,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => stopRecording()}
                    disabled={isBusy}
                    className="w-full py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="w-3 h-3 bg-white rounded-sm" />
                    Stop recording
                  </button>
                </>
              ) : !audioFile ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Mic className="w-7 h-7 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Record a short clip from your mic</p>
                  <p className="text-xs text-gray-400 mb-5">Up to {MAX_DURATION} seconds</p>
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={isBusy}
                    className="px-6 py-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Mic className="w-4 h-4" />
                    Start recording
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {recordedPreviewUrl && (
                    <audio
                      ref={audioRef}
                      src={recordedPreviewUrl}
                      controls
                      className="flex-1 min-w-0"
                    />
                  )}
                  <button
                    type="button"
                    onClick={clearAudio}
                    disabled={isBusy}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
                    aria-label="Remove recording"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`rounded-xl border border-dashed p-6 text-center ${
                fieldErrors.audio ? "border-red-300 bg-red-50/40" : "border-gray-300"
              }`}
            >
              {audioFile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {uploadPreviewUrl && (
                      <audio src={uploadPreviewUrl} controls className="flex-1 min-w-0" />
                    )}
                    <button
                      type="button"
                      onClick={clearAudio}
                      disabled={isBusy}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
                      aria-label="Remove file"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  {duration > 0 && (
                    <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
                      <span>
                        Duration: {formatDuration(duration)}
                        {duration > MAX_DURATION ? ` (max ${MAX_DURATION}s)` : ""}
                      </span>
                      {duration > MAX_DURATION && (
                        <button
                          type="button"
                          onClick={() => openTrimModal(audioFile, duration)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          Trim
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <label className="cursor-pointer">
                    <span className="text-sm font-medium text-gray-900 hover:underline">
                      Choose audio file
                    </span>
                    <input
                      type="file"
                      accept={POST_MEDIA_ACCEPT}
                      onChange={handleAudioSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">{POST_MEDIA_HINT}</p>
                </>
              )}
            </div>
          )}
          <FieldError message={fieldErrors.audio} />
        </div>

        <div
          ref={formErrorRef}
          className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 sm:static sm:mx-0 sm:px-0 sm:pt-0 bg-gradient-to-t from-gray-50 from-60% to-transparent sm:bg-none space-y-3"
        >
          <FieldError message={fieldErrors.form} />
          {isBusy && uploadProgress && (
            <UploadProgressBar
              label={uploadProgress.label}
              percent={uploadProgress.percent}
            />
          )}
          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg sm:shadow-none"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isConverting
                  ? conversionLabel
                  : isUploading
                    ? "Uploading..."
                    : "Publishing..."}
              </>
            ) : (
              "Publish tape"
            )}
          </button>
        </div>
      </form>

      <AudioTrimModal
        isOpen={trimModalOpen}
        file={trimSourceFile}
        sourceDuration={trimSourceDuration}
        maxDurationSeconds={MAX_DURATION}
        title="Trim tape"
        onClose={handleTrimClose}
        onComplete={handleTrimComplete}
      />
    </div>
  );
}
