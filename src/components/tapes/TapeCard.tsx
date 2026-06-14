"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { formatDuration } from "@/utils/voiceHelpers";
import type { Tape } from "@/types/tapes";
import { tapeHref, type TapeFeedSource } from "@/utils/tapeFeedSource";

interface TapeCardProps {
  tape: Tape;
  compact?: boolean;
  feedSource?: TapeFeedSource;
  onBeforeNavigate?: () => void;
}

export default function TapeCard({
  tape,
  compact = false,
  feedSource,
  onBeforeNavigate,
}: TapeCardProps) {
  const creatorName = tape.station?.name ?? tape.user.username ?? tape.user.name;

  return (
    <Link
      href={tapeHref(tape.id, feedSource)}
      onClick={() => onBeforeNavigate?.()}
      className={`group block overflow-hidden rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors ${
        compact ? "" : "shadow-sm hover:shadow-md"
      }`}
    >
      <div className={`relative ${compact ? "aspect-[9/16]" : "aspect-[9/16] max-h-64"} bg-gray-900 overflow-hidden`}>
        <Image
          src={resolveVoiceAssetUrl(tape.thumbnailURL)}
          alt={tape.caption}
          fill
          sizes="(max-width: 768px) 50vw, 200px"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/75 text-white text-xs rounded">
          {formatDuration(tape.duration)}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">{tape.caption}</p>
        <p className="text-xs text-gray-500 mt-1 truncate">{creatorName}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {tape.viewCount.toLocaleString()} listens · {tape.likeCount} likes
        </p>
      </div>
    </Link>
  );
}
