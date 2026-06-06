"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { useVoiceUpload } from "@/hooks/useVoiceUpload";
import { formatDuration } from "@/utils/voiceHelpers";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import {
  Loader2,
  Upload,
  Music,
  ImageIcon,
  Clock,
  AlertCircle,
  X,
} from "@/components/voice/VoiceIcons";

interface Station {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string;
}

const MAX_DURATION = 3600;
const MAX_AUDIO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

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
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thumbnailUpload = useVoiceUpload();
  const audioUpload = useVoiceUpload();

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
    if (stationId && stations.length > 0) {
      setSelectedStation(stationId);
    }
  }, [stationId, stations]);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Thumbnail must be less than 10MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setThumbnailURL("");
    setError(null);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AUDIO_SIZE) {
      setError("Audio file must be less than 500MB");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file");
      return;
    }
    setAudioFile(file);
    setAudioURL("");
    setError(null);
    if (audioRef.current) {
      const prev = audioRef.current.src;
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      audioRef.current.src = URL.createObjectURL(file);
    }
  };

  const handleAudioLoad = () => {
    if (audioRef.current) {
      const audioDuration = Math.floor(audioRef.current.duration);
      setDuration(audioDuration);
      if (audioDuration > MAX_DURATION) {
        setError(`Audio duration exceeds maximum allowed (${MAX_DURATION / 60} minutes)`);
      } else {
        setError(null);
      }
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
  };

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
    if (duration > MAX_DURATION) {
      setError(`Audio duration exceeds maximum allowed (${MAX_DURATION / 60} minutes)`);
      return;
    }
    if (duration === 0) {
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
      if (audioFile && !audioURL) {
        finalAudioURL = await audioUpload.upload(audioFile, "audio");
        setAudioURL(finalAudioURL);
      }
      const res = await Api.post("/voice/post", {
        stationId: selectedStation,
        title,
        description,
        thumbnailURL: finalThumbnailURL,
        audioURL: finalAudioURL,
        duration,
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
  const overallProgress = (() => {
    if (!isUploading) return null;
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
            {!thumbnailFile && !thumbnailPreview ? (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <Upload className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to upload thumbnail</span>
                <input type="file" accept="image/*" onChange={handleThumbnailSelect} className="hidden" />
              </label>
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full max-w-md h-auto rounded-lg" />
                <button
                  type="button"
                  onClick={clearThumbnail}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Music className="w-4 h-4 inline mr-1" />
              Audio File *
            </label>
            {!audioFile ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <Music className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to upload audio</span>
                <input type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />
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
          </div>

          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isUploading && overallProgress !== null && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm text-gray-700 mb-2">
                <span>Uploading files...</span>
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
              isUploading ||
              duration > MAX_DURATION ||
              !selectedStation ||
              !title ||
              (!thumbnailFile && !thumbnailURL) ||
              (!audioFile && !audioURL)
            }
            className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            {publishing || isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isUploading ? "Uploading..." : "Publishing..."}
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
