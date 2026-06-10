"use client";

import React, { useRef, useState } from "react";
import { Camera, X, Loader2, Check } from "@/components/voice/VoiceIcons";
import { useVoiceUpload, UploadType } from "@/hooks/useVoiceUpload";
import ImageCropModal from "@/components/voice/ImageCropModal";
import { STATION_BANNER_ASPECT, STATION_BANNER_SIZE_LABEL } from "@/utils/voiceHelpers";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  type: "avatar" | "banner";
  className?: string;
  enableCrop?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  type,
  className = "",
  enableCrop,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error, reset } = useVoiceUpload();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const isAvatar = type === "avatar";
  const shouldCrop = enableCrop ?? true;
  const cropAspect = isAvatar ? 1 : STATION_BANNER_ASPECT;
  const aspectRatio = isAvatar ? "aspect-square" : "aspect-[3/1]";
  const dimensions = isAvatar ? "400x400" : STATION_BANNER_SIZE_LABEL;

  const uploadFile = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const uploadedUrl = await upload(file, type as UploadType);
      onChange(uploadedUrl);

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
      }, 1000);
    } catch {
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      await uploadFile(file);
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
    await uploadFile(file);
  };

  const handleRemove = () => {
    onChange("");
    setPreviewUrl(null);
    reset();
  };

  const displayUrl = previewUrl || value;

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

      {displayUrl ? (
        <div className={`relative ${aspectRatio} rounded-lg overflow-hidden bg-gray-100`}>
          <img
            src={displayUrl}
            alt={`${type} preview`}
            className="w-full h-full object-cover"
          />

          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
              <div className="w-3/4 h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
              <span className="text-white text-sm mt-1">{progress?.percent || 0}%</span>
            </div>
          )}

          {!uploading && value && !previewUrl && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}

          {!uploading && (
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
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full ${aspectRatio} border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin mb-2" />
              <span className="text-sm text-gray-500">Uploading... {progress?.percent || 0}%</span>
            </>
          ) : (
            <>
              <Camera className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">
                Click to upload {isAvatar ? "avatar" : "banner"}
              </span>
              <span className="text-xs text-gray-400 mt-1">
                Recommended: {dimensions}px
              </span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default ImageUploader;
