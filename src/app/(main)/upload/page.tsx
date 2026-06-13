"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { useVoiceUpload } from "@/hooks/useVoiceUpload";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import { formatDuration } from "@/utils/voiceHelpers";
import {
  getMediaDuration,
  isAllowedPostMediaFile,
  needsAudioExtraction,
  POST_MEDIA_ACCEPT,
  POST_MEDIA_HINT,
} from "@/utils/voiceMediaUpload";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import ThumbnailPicker from "@/components/voice/ThumbnailPicker";
import {
  Loader2,
  Upload,
  Music,
  ImageIcon,
  Clock,
  AlertCircle,
  X,
  Mic,
  Trash2,
} from "@/components/voice/VoiceIcons";

interface Station {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string;
}

const MAX_DURATION = 29 * 60;
const MAX_DURATION_MINUTES = 29;
const MAX_AUDIO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type AudioSource = "upload" | "record";

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stationId = searchParams.get("station");
  const { user, userLoading } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioURL, setAudioURL] = useState("");
  const [audioSource, setAudioSource] = useState<AudioSource>("upload");
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thumbnailUpload = useVoiceUpload();
  const audioUpload = useVoiceUpload();

  const {
    isRecording,
    recordingSeconds,
    recordedBlob,
    recordedPreviewUrl,
    showMaxReachedTooltip,
    startRecording,
    stopRecording,
    resetAudioState,
    formatSeconds,
  } = useVoiceRecorder({
    maxSeconds: MAX_DURATION,
    onPermissionDenied: () =>
      setError("Microphone access is required to record audio"),
  });

  const loadStations = async () => {
    try {
      setLoading(true);
      const res = await Api.get("/voice/station/my-stations");
      setStations(res.data.result || []);
      if (res.data.result.length === 0) {
        router.push("/create-station");
      }
    } catch (err) {
      console.error("Failed to load stations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/upload");
      return;
    }
    loadStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  useEffect(() => {
    if (stations.length === 0) return;

    if (stationId && stations.some((s) => s.id === stationId)) {
      setSelectedStation(stationId);
    } else {
      setSelectedStation(stations[0].id);
    }
  }, [stationId, stations]);

  const handleThumbnailSelect = (file: File, previewUrl: string) => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setThumbnailFile(file);
    setThumbnailURL("");
    setError(null);
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_AUDIO_SIZE) {
      setError("File must be less than 500MB");
      return;
    }
    if (!isAllowedPostMediaFile(file)) {
      setError("Please select an audio or video file");
      return;
    }

    setAudioFile(file);
    setAudioURL("");
    setDuration(0);
    setError(null);

    try {
      const mediaDuration = await getMediaDuration(file);
      setDuration(mediaDuration);
      if (mediaDuration > MAX_DURATION) {
        setError(`Duration exceeds maximum allowed (${MAX_DURATION_MINUTES} minutes)`);
      }
    } catch {
      setError("Could not read this file. Please try a different audio or video file.");
      setAudioFile(null);
      setDuration(0);
    }
  };

  const handleAudioLoad = () => {
    if (!audioRef.current) return;
    const raw = audioRef.current.duration;
    if (!Number.isFinite(raw) || raw <= 0) return;
    const audioDuration = Math.floor(raw);
    setDuration(audioDuration);
    if (audioDuration > MAX_DURATION) {
      setError(`Audio duration exceeds maximum allowed (${MAX_DURATION_MINUTES} minutes)`);
    } else {
      setError(null);
    }
  };

  const clearThumbnail = () => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setThumbnailFile(null);
    setThumbnailURL("");
    thumbnailUpload.reset();
  };

  const clearAudio = () => {
    if (audioRef.current) {
      const prev = audioRef.current.src;
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      audioRef.current.src = "";
    }
    setAudioFile(null);
    setAudioURL("");
    setDuration(0);
    audioUpload.reset();
    resetAudioState();
  };

  const switchAudioSource = (source: AudioSource) => {
    if (source === audioSource) return;
    clearAudio();
    setAudioSource(source);
    setError(null);
  };

  const handleStartRecording = async () => {
    setError(null);
    if (audioFile) clearAudio();
    await startRecording();
  };

  const handleStopRecording = async () => {
    await stopRecording();
  };

  useEffect(() => {
    if (!recordedBlob || audioSource !== "record") return;
    const file = new File(
      [recordedBlob],
      `recording-${Date.now()}.webm`,
      { type: recordedBlob.type }
    );
    setAudioFile(file);
    if (recordingSeconds > 0) {
      setDuration(recordingSeconds);
      setError(null);
    }
    if (recordedPreviewUrl && audioRef.current) {
      const prev = audioRef.current.src;
      if (prev && prev.startsWith("blob:") && prev !== recordedPreviewUrl) {
        URL.revokeObjectURL(prev);
      }
      audioRef.current.src = recordedPreviewUrl;
    }
  }, [recordedBlob, recordedPreviewUrl, audioSource, recordingSeconds]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStation) {
      setError("Please select a station");
      return;
    }
    if (!title) {
      setError("Title is required");
      return;
    }
    if (!thumbnailFile && !thumbnailURL) {
      setError("Thumbnail is required");
      return;
    }
    if (!audioFile && !audioURL) {
      setError("Audio file is required");
      return;
    }
    if (!Number.isFinite(duration) || duration > MAX_DURATION) {
      setError(`Audio duration exceeds maximum allowed (${MAX_DURATION_MINUTES} minutes)`);
      return;
    }
    if (duration <= 0) {
      setError("Could not detect audio duration. Please try a different file.");
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      let finalThumbnailURL = thumbnailURL;
      let finalAudioURL = audioURL;
      if (thumbnailFile && !thumbnailURL) {
        finalThumbnailURL = await thumbnailUpload.upload(thumbnailFile, "thumbnail");
        setThumbnailURL(finalThumbnailURL);
      }
      let finalDuration = duration;
      if (audioFile && !audioURL) {
        const uploadResult = await audioUpload.uploadPostMedia(audioFile);
        finalAudioURL = uploadResult.fileUrl;
        if (uploadResult.duration && uploadResult.duration > 0) {
          finalDuration = uploadResult.duration;
          setDuration(finalDuration);
        }
        setAudioURL(finalAudioURL);
      }
      const res = await Api.post("/voice/post", {
        stationId: selectedStation,
        title,
        description,
        thumbnailURL: finalThumbnailURL,
        audioURL: finalAudioURL,
        duration: finalDuration,
      });
      router.push(`/post/${res.data.result.id}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as Error)?.message ||
        "Failed to create audio";
      setError(message);
    } finally {
      setPublishing(false);
    }
  };

  const isUploading = thumbnailUpload.uploading || audioUpload.uploading;
  const isExtracting = audioUpload.extracting;
  const isBusy = isUploading || isExtracting;
  const overallProgress = (() => {
    if (!isBusy) return null;
    const thumbProgress = thumbnailUpload.progress?.percent || (thumbnailURL ? 100 : 0);
    const audioProgress = audioUpload.progress?.percent || (audioURL ? 100 : 0);
    const hasThumb = thumbnailFile || thumbnailURL;
    const hasAudio = audioFile || audioURL;
    if (hasThumb && hasAudio) return Math.round((thumbProgress + audioProgress) / 2);
    return thumbProgress || audioProgress;
  })();

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Upload className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Create a station first</h2>
        <p className="text-gray-500 mb-4">You need a station to upload audio content</p>
        <button
          onClick={() => router.push("/create-station")}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Create Station
        </button>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} onLoadedMetadata={handleAudioLoad} className="hidden" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upload Audio</h1>
          <p className="text-gray-500 mt-2">Share your voice with the world</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Station *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setSelectedStation(station.id)}
                  className={`flex items-center gap-3 p-4 border rounded-lg transition-colors text-left ${
                    selectedStation === station.id
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {station.avatarURL ? (
                    <Image
                      src={resolveVoiceAssetUrl(station.avatarURL)}
                      alt={station.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold">
                      {station.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{station.name}</div>
                    <div className="text-sm text-gray-500">@{station.handle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Episode title"
              maxLength={100}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this episode about?"
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
            <p className="text-sm text-gray-500 mt-1 text-right">{description.length}/2000</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ImageIcon className="w-4 h-4 inline mr-1" />
              Thumbnail *
            </label>
            <ThumbnailPicker
              previewUrl={thumbnailPreview}
              onSelect={handleThumbnailSelect}
              onClear={clearThumbnail}
              maxSizeBytes={MAX_IMAGE_SIZE}
              onValidationError={setError}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                <Music className="w-4 h-4 inline mr-1" />
                Audio *
              </label>
              <span className="text-xs text-gray-500">Max {MAX_DURATION_MINUTES} minutes</span>
            </div>

            <div className="flex rounded-lg border border-gray-200 p-1 mb-4">
              <button
                type="button"
                onClick={() => switchAudioSource("upload")}
                disabled={isRecording}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  audioSource === "upload"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Upload className="w-4 h-4" />
                Upload file
              </button>
              <button
                type="button"
                onClick={() => switchAudioSource("record")}
                disabled={isRecording}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  audioSource === "record"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Mic className="w-4 h-4" />
                Record on the go
              </button>
            </div>

            {audioSource === "upload" && (
              <>
                {!audioFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                    <Music className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Click to upload audio or video</span>
                    <span className="text-xs text-gray-400 mt-1">{POST_MEDIA_HINT}</span>
                    <input
                      type="file"
                      accept={POST_MEDIA_ACCEPT}
                      onChange={handleAudioSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Music className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 truncate max-w-xs">{audioFile.name}</div>
                          <div className="text-sm text-gray-500">
                            {needsAudioExtraction(audioFile) ? "Video (audio will be extracted) • " : ""}
                            {formatFileSize(audioFile.size)}
                            {duration > 0 && ` • ${formatDuration(duration)}`}
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={clearAudio} className="p-2 text-gray-400 hover:text-red-500">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {duration > 0 && (
                      <div
                        className={`flex items-center gap-2 mt-3 p-3 rounded-lg ${
                          duration > MAX_DURATION ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Duration: {formatDuration(duration)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {audioSource === "record" && (
              <>
                {isRecording ? (
                  <div className="p-6 border border-red-200 bg-red-50/50 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                        </span>
                        <span className="font-medium text-gray-900">Recording...</span>
                      </div>
                      <span className="text-sm font-mono text-gray-700">
                        {formatSeconds(recordingSeconds)} / {formatSeconds(MAX_DURATION)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full bg-red-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, (recordingSeconds / MAX_DURATION) * 100)}%` }}
                      />
                    </div>
                    {showMaxReachedTooltip && (
                      <p className="text-sm text-amber-700 mb-3">
                        Maximum duration of {MAX_DURATION_MINUTES} minutes reached.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="w-3 h-3 bg-white rounded-sm" />
                      Stop recording
                    </button>
                  </div>
                ) : !audioFile ? (
                  <div className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Mic className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Record audio directly from your microphone</p>
                    <p className="text-xs text-gray-400 mb-5">Up to {MAX_DURATION_MINUTES} minutes</p>
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      Start recording
                    </button>
                  </div>
                ) : (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Mic className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Voice recording</div>
                          <div className="text-sm text-gray-500">
                            {formatFileSize(audioFile.size)}
                            {duration > 0 && ` • ${formatDuration(duration)}`}
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={clearAudio} className="p-2 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    {recordedPreviewUrl && (
                      <audio src={recordedPreviewUrl} controls className="w-full mt-3" />
                    )}
                    {duration > 0 && (
                      <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-green-50 text-green-700">
                        <Clock className="w-4 h-4" />
                        <span>Duration: {formatDuration(duration)}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="mt-3 w-full py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Record again
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isBusy && overallProgress !== null && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm text-gray-700 mb-2">
                <span>{isExtracting ? "Extracting audio from video..." : "Uploading files..."}</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={
              publishing ||
              isBusy ||
              isRecording ||
              !Number.isFinite(duration) ||
              duration > MAX_DURATION ||
              duration <= 0 ||
              !selectedStation ||
              !title ||
              (!thumbnailFile && !thumbnailURL) ||
              (!audioFile && !audioURL)
            }
            className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            {publishing || isBusy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isExtracting ? "Extracting audio..." : isUploading ? "Uploading..." : "Publishing..."}
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Publish
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
