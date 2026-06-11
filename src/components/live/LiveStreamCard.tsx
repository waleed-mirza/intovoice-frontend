"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { LiveStream } from "@/types/live";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { formatTimeAgo } from "@/utils/voiceHelpers";
import LivePulseRings from "./LivePulseRings";

interface LiveStreamCardProps {
  stream: LiveStream;
  featured?: boolean;
}

const LiveStreamCard = ({ stream, featured = false }: LiveStreamCardProps) => {
  const avatarUrl = stream.station?.avatarURL
    ? resolveVoiceAssetUrl(stream.station.avatarURL)
    : stream.user.profileImg
      ? resolveVoiceAssetUrl(stream.user.profileImg)
      : null;

  const displayName = stream.station?.name || stream.user.name;
  const subtitle = stream.station
    ? `@${stream.station.handle} · ${stream.user.name}`
    : stream.user.username
      ? `@${stream.user.username}`
      : stream.user.name;

  return (
    <Link
      href={`/live/${stream.id}`}
      className={`block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${
        featured ? "lg:col-span-2" : ""
      }`}
    >
      <div className={`p-5 ${featured ? "lg:p-6" : ""}`}>
        <div className="flex items-start gap-4">
          <LivePulseRings active>
            <div
              className={`rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ${
                featured ? "w-20 h-20" : "w-14 h-14"
              }`}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={featured ? 80 : 56}
                  height={featured ? 80 : 56}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </LivePulseRings>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-900 text-white text-xs font-medium">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-gray-400"
                  style={{ animation: "voiceCommentPulse 1s ease-in-out infinite alternate" }}
                />
                LIVE
              </span>
              <span className="text-xs text-gray-500">
                {formatTimeAgo(stream.startedAt)}
              </span>
            </div>

            <h3
              className={`font-semibold text-gray-900 truncate ${
                featured ? "text-xl" : "text-base"
              }`}
            >
              {stream.title}
            </h3>
            <p className="text-sm text-gray-500 truncate mt-0.5">{subtitle}</p>
            {featured && stream.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                {stream.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default LiveStreamCard;
