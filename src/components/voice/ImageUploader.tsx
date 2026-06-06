"use client";

import React, { useRef, useState } from "react";
import { Camera, X, Loader2, Check } from "@/components/voice/VoiceIcons";
import { useVoiceUpload, UploadType } from "@/hooks/useVoiceUpload";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  type: "avatar" | "banner";
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  type,
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error, reset } = useVoiceUpload();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isAvatar = type === "avatar";
  const aspectRatio = isAvatar ? "aspect-square" : "aspect-[4/1]";
  const dimensions = isAvatar ? "400x400" : "1280x320";

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const uploadedUrl = await upload(file, type as UploadType);
      
      // Update parent with the uploaded URL
      onChange(uploadedUrl);
      
      // Keep showing preview for 1 second to ensure smooth transition
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
      }, 1000);
    } catch {
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
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

      {displayUrl ? (
        <div className={`relative ${aspectRatio} rounded-lg overflow-hidden bg-gray-100`}>
          <img
            src={displayUrl}
            alt={`${type} preview`}
            className="w-full h-full object-cover"
          />
          
          {/* Uploading overlay */}
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

          {/* Success indicator */}
          {!uploading && value && !previewUrl && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}

          {/* Actions */}
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

      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
};

export default ImageUploader;
