"use client";

import React, { useState } from "react";
import { IoIosShareAlt } from "react-icons/io";
import { toast } from "react-toastify";

interface ShareTapeButtonProps {
  tapeId: string;
  caption: string;
  variant?: "pill" | "rail";
  theme?: "default" | "overlay";
  compact?: boolean;
  className?: string;
}

export default function ShareTapeButton({
  tapeId,
  caption,
  variant = "pill",
  theme = "default",
  compact = false,
  className = "",
}: ShareTapeButtonProps) {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/tapes/${tapeId}`
        : `/tapes/${tapeId}`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Into Voice Tape",
          text: caption.slice(0, 100),
          url,
        });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      } catch {
        toast.error("Could not share tape");
      }
    } finally {
      setSharing(false);
    }
  };

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors flex-shrink-0 disabled:opacity-50 ${className}`}
        aria-label="Share tape"
      >
        <IoIosShareAlt className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </button>
    );
  }

  const isOverlay = theme === "overlay";
  const glyphSize = isOverlay
    ? compact
      ? "w-7 h-7"
      : "w-8 h-8"
    : compact
      ? "w-4 h-4"
      : "w-4 h-4 sm:w-5 sm:h-5";

  if (isOverlay) {
    const glyphSize = compact ? "w-6 h-6" : "w-7 h-7";
    const iconWrap =
      "flex items-center justify-center rounded-full bg-gray-100/95 p-2.5 shadow-md shadow-black/20 text-gray-800";
    const labelClass =
      "text-[11px] font-semibold text-white tabular-nums leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]";

    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className={`flex flex-col items-center gap-1.5 disabled:opacity-50 ${className}`}
        aria-label="Share tape"
      >
        <span className={iconWrap}>
          <IoIosShareAlt className={glyphSize} />
        </span>
        <span className={labelClass}>Share</span>
      </button>
    );
  }

  const iconSize = compact ? "w-9 h-9" : "w-9 h-9 sm:w-11 sm:h-11";
  const iconClass = `${iconSize} rounded-full bg-white shadow-md text-gray-800 hover:bg-gray-50 flex items-center justify-center transition-colors`;

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className={`flex flex-col items-center gap-0.5 disabled:opacity-50 ${className}`}
      aria-label="Share tape"
    >
      <span className={iconClass}>
        <IoIosShareAlt className={glyphSize} />
      </span>
    </button>
  );
}
