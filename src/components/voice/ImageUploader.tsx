"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, X } from "@/components/voice/VoiceIcons";
import ImageCropModal from "@/components/voice/ImageCropModal";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { STATION_BANNER_ASPECT, STATION_BANNER_SIZE_LABEL } from "@/utils/voiceHelpers";

interface ImageUploaderProps {
  /** Committed S3 key (saved in DB or after last successful save). */
  value: string;
  onValueChange: (key: string) => void;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  /** User removed the committed asset; parent should delete on save. */
  removed?: boolean;
  onRemovedChange?: (removed: boolean) => void;
  type: "avatar" | "banner";
  className?: string;
  enableCrop?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onValueChange,
  pendingFile,
  onPendingFileChange,
  removed = false,
  onRemovedChange,
  type,
  className = "",
  enableCrop,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const isAvatar = type === "avatar";
  const shouldCrop = enableCrop ?? true;
  const cropAspect = isAvatar ? 1 : STATION_BANNER_ASPECT;
  const aspectRatio = isAvatar ? "aspect-square" : "aspect-[3/1]";
  const dimensions = isAvatar ? "400x400" : STATION_BANNER_SIZE_LABEL;

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(pendingFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingFile]);

  const selectFile = (file: File) => {
    onRemovedChange?.(false);
    onPendingFileChange(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    if (shouldCrop) {
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setCropModalOpen(true);
    } else {
      selectFile(file);
    }

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
    selectFile(file);
  };

  const handleRemove = () => {
    onPendingFileChange(null);
    if (value) {
      onRemovedChange?.(true);
      onValueChange("");
    }
  };

  const displayUrl =
    previewUrl || (!removed && value ? resolveVoiceAssetUrl(value) : "");
  const hasPreview = Boolean(displayUrl);

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
          aspect={cropAspect}
          cropShape={isAvatar ? "round" : "rect"}
          outputFileName={isAvatar ? "avatar.jpg" : "banner.jpg"}
          title={isAvatar ? "Crop profile photo" : "Crop cover photo"}
          onClose={handleCropClose}
          onComplete={handleCropComplete}
        />
      )}

      {hasPreview ? (
        <div className={`relative ${aspectRatio} rounded-lg overflow-hidden bg-gray-100`}>
          <img
            src={displayUrl}
            alt={`${type} preview`}
            className="w-full h-full object-cover"
          />

          {pendingFile && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-medium">
              Unsaved
            </div>
          )}

          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="p-2 bg-white/90 rounded-lg shadow-sm hover:bg-white transition-colors"
            >
              <Camera className="w-4 h-4 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 bg-white/90 rounded-lg shadow-sm hover:bg-white transition-colors"
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full ${aspectRatio} border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer`}
        >
          <Camera className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">
            Click to upload {isAvatar ? "avatar" : "banner"}
          </span>
          <span className="text-xs text-gray-400 mt-1">
            Recommended: {dimensions}px
          </span>
        </button>
      )}
    </div>
  );
};

export default ImageUploader;
