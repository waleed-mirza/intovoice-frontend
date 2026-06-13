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

function ZoomControls({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  onAdjust,
  variant = "light",
}: {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange: (value: number) => void;
  onAdjust: (delta: number) => void;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
        isDark
          ? "bg-white/10 backdrop-blur-md border border-white/15"
          : "bg-gray-100 border border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={() => onAdjust(-ZOOM_STEP)}
        disabled={zoom <= minZoom + 0.01}
        aria-label="Zoom out"
        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg leading-none transition-colors disabled:opacity-30 ${
          isDark
            ? "text-white/90 hover:bg-white/15"
            : "text-gray-700 hover:bg-gray-200"
        }`}
      >
        −
      </button>

      <input
        type="range"
        min={minZoom}
        max={maxZoom}
        step={0.02}
        value={zoom}
        onChange={(e) => onZoomChange(Number(e.target.value))}
        aria-label="Zoom"
        className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer ${
          isDark ? "bg-white/25 accent-white" : "bg-gray-300 accent-gray-900"
        }`}
      />

      <button
        type="button"
        onClick={() => onAdjust(ZOOM_STEP)}
        disabled={zoom >= maxZoom - 0.01}
        aria-label="Zoom in"
        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg leading-none transition-colors disabled:opacity-30 ${
          isDark
            ? "text-white/90 hover:bg-white/15"
            : "text-gray-700 hover:bg-gray-200"
        }`}
      >
        +
      </button>

      <span
        className={`w-10 shrink-0 text-right text-xs tabular-nums ${
          isDark ? "text-white/70" : "text-gray-500"
        }`}
      >
        {zoom.toFixed(1)}×
      </span>
    </div>
  );
}

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
  const [zoomWithScroll, setZoomWithScroll] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(pointer: fine)");
    const update = () => setZoomWithScroll(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
        setCropSize(getCropSizeFittingMedia(mediaSize.width, mediaSize.height, aspect));
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

        <div className="fixed inset-0 overflow-hidden sm:overflow-y-auto">
          <div className="flex h-[100dvh] sm:min-h-full sm:h-auto sm:items-center sm:justify-center sm:p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-250"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.98]"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.98]"
            >
              <Dialog.Panel
                className={`w-full h-full sm:h-auto sm:max-h-[min(90vh,820px)] flex flex-col bg-white shadow-2xl transition-all ${
                  isBanner ? "sm:max-w-2xl sm:rounded-2xl" : "sm:max-w-md sm:rounded-2xl"
                }`}
              >
                <div className="shrink-0 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-5 sm:py-4 border-b border-gray-100">
                  <div className="min-w-0">
                    <Dialog.Title className="text-base font-semibold text-gray-900">
                      {title}
                    </Dialog.Title>
                    <p className="text-xs text-gray-500 mt-0.5 sm:hidden">
                      Drag to move · pinch or slide to zoom
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
                      Drag to move · scroll or slide to zoom
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="shrink-0 p-2 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div
                  className={`voice-crop-stage relative bg-black flex-1 min-h-0 sm:flex-none touch-none ${
                    cropShape === "round" ? "voice-crop-stage--round" : ""
                  } ${isBanner ? "sm:h-[320px]" : "sm:h-80"}`}
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
                    zoomWithScroll={zoomWithScroll}
                    onMediaLoaded={onMediaLoaded}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>

                <div className="shrink-0 px-4 sm:px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 bg-white border-t border-gray-100 sm:border-t-0">
                  <ZoomControls
                    zoom={zoom}
                    minZoom={minZoom}
                    maxZoom={maxZoom}
                    onZoomChange={setZoom}
                    onAdjust={adjustZoom}
                    variant="light"
                  />

                  {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={saving}
                      className="flex-1 py-3 sm:py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !croppedAreaPixels}
                      className="flex-[2] py-3 sm:py-2.5 text-sm font-medium bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
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
