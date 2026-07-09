"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { useVoiceUpload } from "@/hooks/useVoiceUpload";
import { formatDuration } from "@/utils/voiceHelpers";
import {
  getMediaDuration,
  isAllowedPostMediaFile,
  needsAudioExtraction,
  POST_MEDIA_ACCEPT,
  POST_MEDIA_HINT,
} from "@/utils/voiceMediaUpload";
import { isMp3File } from "@/utils/transcodeAudioToMp3";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { releaseUploadedAssets } from "@/lib/uploadFileToS3";
import UploadProgressBar from "@/components/voice/UploadProgressBar";
import { getCombinedUploadProgress, getAudioConversionLabel } from "@/utils/uploadProgress";
import ThumbnailPicker from "@/components/voice/ThumbnailPicker";
import AudioTrimModal from "@/components/voice/AudioTrimModal";
import {
  Loader2,
  Music,
  ImageIcon,
  Clock,
  AlertCircle,
  CheckCircle,
  Save,
  Scissors,
  X,
} from "@/components/voice/VoiceIcons";

const MAX_DURATION = 29 * 60;
const MAX_DURATION_MINUTES = 29;
const MAX_AUDIO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

interface PostData {
  id: string;
  title: string;
  description?: string;
  thumbnailURL: string;
  audioURL: string;
  duration: number;
  station: { id: string; name: string; handle: string; user: { id: string } };
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [newThumbnailURL, setNewThumbnailURL] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [newAudioURL, setNewAudioURL] = useState("");
  const [newDuration, setNewDuration] = useState(0);
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimSourceFile, setTrimSourceFile] = useState<File | null>(null);
  const [trimSourceDuration, setTrimSourceDuration] = useState(0);

  const thumbnailUpload = useVoiceUpload();
  const audioUpload = useVoiceUpload();

  const loadPost = async () => {
    try {
      setLoading(true);
      const res = await Api.get(`/voice/post/${id}`);
      const p: PostData = res.data.result;
      if (p.station.user.id !== user?.id) {
        router.replace(`/post/${id}`);
        return;
      }
      setPost(p);
      setTitle(p.title);
      setDescription(p.description || "");
    } catch {
      setError("Failed to load audio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    if (userLoading) return;
    if (!user) {
      router.push(`/auth/login?redirect=/post/${id}/edit`);
      return;
    }
    loadPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, userLoading]);

  const handleThumbnailSelect = (file: File, previewUrl: string) => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setThumbnailFile(file);
    setNewThumbnailURL("");
    setError(null);
  };

  const clearThumbnail = () => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setThumbnailFile(null);
    setNewThumbnailURL("");
    thumbnailUpload.reset();
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
      setError("File must be less than 500MB");
      return;
    }
    if (!isAllowedPostMediaFile(file)) {
      setError("Please select an audio or video file");
      return;
    }

    setNewAudioURL("");
    setError(null);

    try {
      const mediaDuration = await getMediaDuration(file);
      if (mediaDuration > MAX_DURATION) {
        setAudioFile(null);
        setNewDuration(0);
        openTrimModal(file, mediaDuration);
        return;
      }
      setAudioFile(file);
      setNewDuration(mediaDuration);
    } catch {
      setError("Could not read this file. Please try a different audio or video file.");
      setAudioFile(null);
      setNewDuration(0);
    }
  };

  const handleTrimComplete = async (trimmedFile: File, trimmedDuration: number) => {
    setAudioFile(trimmedFile);
    setNewAudioURL("");
    setNewDuration(trimmedDuration);
    setError(null);
    setTrimSourceFile(null);
    setTrimSourceDuration(0);
  };

  const handleTrimClose = () => {
    setTrimModalOpen(false);
    setTrimSourceFile(null);
    setTrimSourceDuration(0);
  };

  const handleAudioLoad = () => {
    if (audioRef.current) {
      const d = Math.floor(audioRef.current.duration);
      if (d > MAX_DURATION) {
        const file = audioFile;
        if (file) {
          setAudioFile(null);
          setNewDuration(0);
          openTrimModal(file, d);
        } else {
          setError(`Audio duration exceeds maximum allowed (${MAX_DURATION_MINUTES} minutes)`);
        }
        return;
      }
      setNewDuration(d);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (audioFile && newDuration > MAX_DURATION) {
      openTrimModal(audioFile, newDuration);
      return;
    }
    const uploadedKeys: string[] = [];
    try {
      setSaving(true);
      setError(null);
      let finalThumbnailURL = post.thumbnailURL;
      if (thumbnailFile && !newThumbnailURL) {
        finalThumbnailURL = await thumbnailUpload.upload(thumbnailFile, "thumbnail", {
          replaceKey: post.thumbnailURL,
        });
        uploadedKeys.push(finalThumbnailURL);
        setNewThumbnailURL(finalThumbnailURL);
      } else if (newThumbnailURL) {
        finalThumbnailURL = newThumbnailURL;
      }
      let finalAudioURL = post.audioURL;
      let finalDuration = post.duration;
      if (audioFile && !newAudioURL) {
        const uploadResult = await audioUpload.uploadPostMedia(audioFile, {
          replaceKey: post.audioURL,
          knownDuration: newDuration,
        });
        finalAudioURL = uploadResult.assetKey;
        uploadedKeys.push(finalAudioURL);
        finalDuration = uploadResult.duration && uploadResult.duration > 0
          ? uploadResult.duration
          : newDuration;
        setNewAudioURL(finalAudioURL);
        setNewDuration(finalDuration);
      } else if (newAudioURL) {
        finalAudioURL = newAudioURL;
        finalDuration = newDuration;
      }
      await Api.put(`/voice/post/${id}`, {
        title: title.trim(),
        description: description.trim(),
        thumbnailURL: finalThumbnailURL,
        audioURL: finalAudioURL,
        duration: finalDuration,
      });
      router.push(`/post/${id}`);
    } catch (err: unknown) {
      await releaseUploadedAssets(uploadedKeys);
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as Error)?.message ||
        "Failed to save audio";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const isUploading = thumbnailUpload.uploading || audioUpload.uploading;
  const isConverting = audioUpload.converting;
  const isBusy = isUploading || isConverting;
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
      hasThumbnail: Boolean(thumbnailFile || newThumbnailURL || post?.thumbnailURL),
      hasAudio: Boolean(audioFile || newAudioURL),
      thumbnailDone: Boolean(newThumbnailURL),
      audioDone: Boolean(newAudioURL),
      audioFile,
    }
  );

  const conversionLabel = getAudioConversionLabel(audioFile);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-gray-500">{error || "Audio not found."}</p>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} onLoadedMetadata={handleAudioLoad} className="hidden" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Edit Audio</h1>
          <p className="text-gray-500 mt-2">Update your audio details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
            <p className="text-sm text-gray-500 mt-1 text-right">{description.length}/2000</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ImageIcon className="w-4 h-4 inline mr-1" />
              Thumbnail
            </label>
            {!thumbnailFile && post && (
              <div className="mb-3 w-full max-w-md aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveVoiceAssetUrl(post.thumbnailURL)}
                  alt="Current thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <ThumbnailPicker
              previewUrl={thumbnailPreview}
              onSelect={handleThumbnailSelect}
              onClear={clearThumbnail}
              maxSizeBytes={MAX_IMAGE_SIZE}
              onValidationError={setError}
              emptyLabel="Replace thumbnail (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Music className="w-4 h-4 inline mr-1" />
              Audio File
            </label>
            {!audioFile && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 font-medium flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Duration: {formatDuration(post.duration)}
                </p>
              </div>
            )}
            {!audioFile ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50">
                <Music className="w-8 h-8 text-gray-400 mb-1" />
                <span className="text-sm text-gray-500">Replace audio or video file (optional)</span>
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
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-gray-900 truncate min-w-0">{audioFile.name}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setAudioFile(null);
                      setNewAudioURL("");
                      setNewDuration(0);
                      audioUpload.reset();
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 flex-shrink-0"
                    aria-label="Remove audio"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {needsAudioExtraction(audioFile) ? (
                  <p className="text-sm text-gray-500 mt-1">Video selected — audio will be extracted and converted to MP3 on upload.</p>
                ) : !isMp3File(audioFile) ? (
                  <p className="text-sm text-gray-500 mt-1">Will be converted to MP3 on upload.</p>
                ) : null}
                {newDuration > 0 && (
                  <div
                    className={`flex items-center justify-between gap-2 mt-3 p-3 rounded-lg ${
                      newDuration > MAX_DURATION
                        ? "bg-amber-50 text-amber-800"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>Duration: {formatDuration(newDuration)}</span>
                    </div>
                    {newDuration > MAX_DURATION && (
                      <button
                        type="button"
                        onClick={() => openTrimModal(audioFile, newDuration)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors flex-shrink-0"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        Trim
                      </button>
                    )}
                  </div>
                )}
                {newAudioURL && (
                  <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Upload complete
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

          {isBusy && uploadProgress && (
            <UploadProgressBar
              label={uploadProgress.label}
              percent={uploadProgress.percent}
            />
          )}

          <button
            type="submit"
            disabled={
              saving ||
              isBusy ||
              !title.trim() ||
              (audioFile ? newDuration > MAX_DURATION : false)
            }
            className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
          >
            {saving || isBusy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isConverting
                  ? conversionLabel
                  : isUploading
                    ? "Uploading..."
                    : "Saving..."}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>

      <AudioTrimModal
        isOpen={trimModalOpen}
        file={trimSourceFile}
        sourceDuration={trimSourceDuration}
        maxDurationSeconds={MAX_DURATION}
        title="Trim voice post"
        onClose={handleTrimClose}
        onComplete={handleTrimComplete}
      />
    </>
  );
}
