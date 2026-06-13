"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { useVoiceUpload } from "@/hooks/useVoiceUpload";
import {
  TAPE_THUMBNAIL_ASPECT,
  TAPE_THUMBNAIL_SIZE_LABEL,
  formatDuration,
} from "@/utils/voiceHelpers";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { TAPE_FORM_PAGE } from "@/utils/tapeLayout";
import ThumbnailPicker from "@/components/voice/ThumbnailPicker";
import { Loader2, AlertCircle, Save } from "@/components/voice/VoiceIcons";
import type { Tape } from "@/types/tapes";

export default function EditTapePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();

  const [tape, setTape] = useState<Tape | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [newThumbnailURL, setNewThumbnailURL] = useState("");

  const thumbnailUpload = useVoiceUpload();

  const loadTape = async () => {
    try {
      setLoading(true);
      const res = await Api.get(`/voice/tape/${id}`);
      const t: Tape = res.data.result;
      if (t.userId !== user?.id && !t.isOwner) {
        router.replace(`/tapes/${id}`);
        return;
      }
      setTape(t);
      setCaption(t.caption);
    } catch {
      setError("Failed to load tape.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    if (userLoading) return;
    if (!user) {
      router.push(`/auth/login?redirect=/tapes/${id}/edit`);
      return;
    }
    loadTape();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, userLoading]);

  const handleThumbnailSelect = (file: File, previewUrl: string) => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setThumbnailFile(file);
    setNewThumbnailURL("");
  };

  const clearThumbnail = () => {
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setThumbnailFile(null);
    setNewThumbnailURL("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tape) return;
    const trimmed = caption.trim();
    if (!trimmed) {
      setError("Caption is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let finalThumbnailURL = tape.thumbnailURL;
      if (thumbnailFile && !newThumbnailURL) {
        finalThumbnailURL = await thumbnailUpload.upload(thumbnailFile, "thumbnail");
        setNewThumbnailURL(finalThumbnailURL);
      } else if (newThumbnailURL) {
        finalThumbnailURL = newThumbnailURL;
      }

      await Api.patch(`/voice/tape/${id}`, {
        caption: trimmed,
        ...(finalThumbnailURL !== tape.thumbnailURL
          ? { thumbnailURL: finalThumbnailURL }
          : {}),
      });

      router.push(`/tapes/${id}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as Error)?.message ||
        "Failed to save tape";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || thumbnailUpload.uploading;

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tape) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-gray-500">{error || "Tape not found."}</p>
      </div>
    );
  }

  const thumbnailDisplay =
    thumbnailPreview || resolveVoiceAssetUrl(tape.thumbnailURL);

  return (
    <div className={TAPE_FORM_PAGE}>
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Edit tape</h1>
        <p className="text-gray-500 text-sm mt-1">Update caption or thumbnail</p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-2">
            Caption
          </label>
          <textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What's this tape about?"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{caption.length}/500</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thumbnail
          </label>
          <div className="mx-auto h-[min(45vh,28rem)] max-h-[50vh] min-h-[180px] sm:min-h-[200px] aspect-[9/16] w-auto">
            <ThumbnailPicker
              previewUrl={thumbnailDisplay}
              onSelect={handleThumbnailSelect}
              onClear={clearThumbnail}
              onValidationError={setError}
              aspect={TAPE_THUMBNAIL_ASPECT}
              aspectClassName="h-full w-full"
              className="h-full w-full"
              sizeLabel={TAPE_THUMBNAIL_SIZE_LABEL}
              ratioLabel="9:16"
              emptyLabel="Click to upload vertical thumbnail"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Audio</label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <audio
              src={resolveVoiceAssetUrl(tape.audioURL)}
              controls
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-2">
              Duration: {formatDuration(tape.duration)} — audio cannot be changed after publishing
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 sm:static sm:mx-0 sm:px-0 sm:pt-0 bg-gradient-to-t from-gray-50 from-60% to-transparent sm:bg-none">
          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg sm:shadow-none"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
