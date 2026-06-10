"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useCallback, useEffect, useState } from "react";
import Cropper, { type Area, type MediaSize, type Size } from "react-easy-crop";
import { Loader2, X } from "@/components/voice/VoiceIcons";
import {
  computeCoverZoom,
  getCropSizeFittingMedia,
  getCroppedImageBlob,
} from "@/utils/cropImage";

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  aspect?: number;
  cropShape?: "round" | "rect";
  outputFileName?: string;
  title?: string;
  onClose: () => void;
  onComplete: (file: File) => Promise<void>;
}

const ZOOM_STEP = 0.1;
const BASE_MAX_ZOOM = 4;

export default function ImageCropModal({
  isOpen,
  imageSrc,
  aspect = 1,
  cropShape = "rect",
  outputFileName = "image.jpg",
  title = "Crop image",
  onClose,
  onComplete,
}: ImageCropModalProps) {
  const isBanner = aspect > 1;

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(BASE_MAX_ZOOM);
  const [cropSize, setCropSize] = useState<Size | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setMinZoom(1);
      setMaxZoom(BASE_MAX_ZOOM);
      setCropSize(undefined);
      setCroppedAreaPixels(null);
      setError(null);
    }
  }, [isOpen, imageSrc]);

  const onMediaLoaded = useCallback(
    (mediaSize: MediaSize) => {
      const coverZoom = computeCoverZoom(mediaSize.width, mediaSize.height, aspect);

      if (aspect > 1) {
        setCropSize(
          getCropSizeFittingMedia(mediaSize.width, mediaSize.height, aspect)
        );
      } else {
        setCropSize(undefined);
      }

      setMinZoom(1);
      setMaxZoom(Math.max(BASE_MAX_ZOOM, coverZoom + 0.5));
      setZoom(1);
    },
    [aspect]
  );

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const adjustZoom = (delta: number) => {
    setZoom((current) => {
      const next = Math.round((current + delta) * 100) / 100;
      return Math.min(maxZoom, Math.max(minZoom, next));
    });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      setSaving(true);
      setError(null);
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], outputFileName, { type: "image/jpeg" });
      await onComplete(file);
      onClose();
    } catch {
      setError("Failed to crop image. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[120]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center sm:p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-250"
              enterFrom="opacity-0 translate-y-6 sm:translate-y-2 sm:scale-[0.98]"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-6 sm:translate-y-2 sm:scale-[0.98]"
            >
              <Dialog.Panel
                className={`w-full transform overflow-hidden bg-white shadow-2xl transition-all ${
                  isBanner
                    ? "sm:max-w-2xl sm:rounded-2xl rounded-t-2xl"
                    : "max-w-md sm:rounded-2xl rounded-t-2xl"
                }`}
              >
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-gray-900">
                      {title}
                    </Dialog.Title>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Drag to move · scroll or slide to zoom
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div
                  className={`voice-crop-stage relative bg-black ${
                    cropShape === "round" ? "voice-crop-stage--round" : ""
                  } ${isBanner ? "h-[280px] sm:h-[320px]" : "h-72 sm:h-80"}`}
                >
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    minZoom={minZoom}
                    maxZoom={maxZoom}
                    aspect={aspect}
                    cropSize={cropSize}
                    cropShape={cropShape}
                    objectFit="contain"
                    showGrid={false}
                    restrictPosition
                    zoomWithScroll
                    onMediaLoaded={onMediaLoaded}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />

                  <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                    <div className="pointer-events-auto mx-auto max-w-xs flex items-center gap-2.5 px-3 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                      <button
                        type="button"
                        onClick={() => adjustZoom(-ZOOM_STEP)}
                        disabled={zoom <= minZoom + 0.01}
                        aria-label="Zoom out"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-white/90 hover:bg-white/15 disabled:opacity-30 transition-colors text-lg leading-none"
                      >
                        −
                      </button>

                      <input
                        type="range"
                        min={minZoom}
                        max={maxZoom}
                        step={0.02}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        aria-label="Zoom"
                        className="flex-1 h-1 rounded-full appearance-none bg-white/25 accent-white cursor-pointer"
                      />

                      <button
                        type="button"
                        onClick={() => adjustZoom(ZOOM_STEP)}
                        disabled={zoom >= maxZoom - 0.01}
                        aria-label="Zoom in"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-white/90 hover:bg-white/15 disabled:opacity-30 transition-colors text-lg leading-none"
                      >
                        +
                      </button>

                      <span className="w-9 text-right text-[11px] tabular-nums text-white/70">
                        {zoom.toFixed(1)}×
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                  {error && (
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  )}

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={saving}
                      className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !croppedAreaPixels}
                      className="flex-[2] py-2.5 text-sm font-medium bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Use photo"
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
