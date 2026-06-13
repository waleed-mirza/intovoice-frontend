"use client";

import React, { useRef, useState } from "react";
import { Camera, Upload, X } from "@/components/voice/VoiceIcons";
import ImageCropModal from "@/components/voice/ImageCropModal";
import {
  VOICE_POST_THUMBNAIL_ASPECT,
  VOICE_POST_THUMBNAIL_SIZE_LABEL,
} from "@/utils/voiceHelpers";

interface ThumbnailPickerProps {
  previewUrl: string;
  onSelect: (file: File, previewUrl: string) => void;
  onClear: () => void;
  maxSizeBytes?: number;
  onValidationError?: (message: string) => void;
  emptyLabel?: string;
  className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

export default function ThumbnailPicker({
  previewUrl,
  onSelect,
  onClear,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  onValidationError,
  emptyLabel = "Click to upload thumbnail",
  className = "",
}: ThumbnailPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const openFilePicker = () => inputRef.current?.click();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeBytes) {
      onValidationError?.(
        `Thumbnail must be less than ${Math.round(maxSizeBytes / (1024 * 1024))}MB`
      );
      return;
    }
    if (!file.type.startsWith("image/")) {
      onValidationError?.("Please select an image file");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropModalOpen(true);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleCropClose = () => {
    setCropModalOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  };

  const handleCropComplete = async (file: File) => {
    onSelect(file, URL.createObjectURL(file));
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {cropImageSrc && (
        <ImageCropModal
          isOpen={cropModalOpen}
          imageSrc={cropImageSrc}
          aspect={VOICE_POST_THUMBNAIL_ASPECT}
          cropShape="rect"
          outputFileName="thumbnail.jpg"
          title="Crop thumbnail"
          onClose={handleCropClose}
          onComplete={handleCropComplete}
        />
      )}

      {!previewUrl ? (
        <button
          type="button"
          onClick={openFilePicker}
          className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <Upload className="w-10 h-10 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">{emptyLabel}</span>
          <span className="text-xs text-gray-400 mt-1">
            Recommended: {VOICE_POST_THUMBNAIL_SIZE_LABEL}px (16:9)
          </span>
        </button>
      ) : (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Thumbnail preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={openFilePicker}
              aria-label="Change thumbnail"
              className="p-2 bg-white/90 rounded-lg shadow-sm hover:bg-white transition-colors"
            >
              <Camera className="w-4 h-4 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove thumbnail"
              className="p-2 bg-red-500 text-white rounded-lg shadow-sm hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
