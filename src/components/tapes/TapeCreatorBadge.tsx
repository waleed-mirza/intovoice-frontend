"use client";

import React from "react";
import Link from "next/link";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { User } from "@/components/voice/VoiceIcons";
import type { Tape } from "@/types/tapes";

interface TapeCreatorBadgeProps {
  tape: Tape;
  variant?: "default" | "overlay";
}

export default function TapeCreatorBadge({ tape, variant = "overlay" }: TapeCreatorBadgeProps) {
  const isOverlay = variant === "overlay";
  const stationId = tape.stationId ?? tape.station?.id ?? null;

  const linkClass = "flex items-center gap-2.5 min-w-0 group";
  const stopNav = (e: React.MouseEvent) => e.stopPropagation();

  if (stationId) {
    const station = tape.station;
    const stationName = station?.name ?? "Station";
    const stationHandle = station?.handle;

    return (
      <Link
        href={`/station/${stationId}`}
        className={linkClass}
        onClick={stopNav}
      >
        {station?.avatarURL ? (
          <img
            src={resolveVoiceAssetUrl(station.avatarURL)}
            alt={stationName}
            className={`w-9 h-9 rounded-full object-cover flex-shrink-0 ${
              isOverlay ? "ring-2 ring-white/30" : ""
            }`}
          />
        ) : (
          <div
            className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
              isOverlay
                ? "bg-white/20 text-white ring-2 ring-white/30"
                : "bg-gray-800 text-white"
            }`}
          >
            {stationName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold truncate ${
              isOverlay
                ? "text-white group-hover:text-white/80"
                : "text-gray-900 group-hover:text-gray-600"
            }`}
          >
            {stationName}
          </p>
          {stationHandle && (
            <p className={`text-xs truncate ${isOverlay ? "text-white/60" : "text-gray-400"}`}>
              @{stationHandle}
            </p>
          )}
        </div>
      </Link>
    );
  }

  const displayName = tape.user.username
    ? `@${tape.user.username}`
    : tape.user.name;

  return (
    <Link
      href={`/user/${tape.user.id}`}
      className={linkClass}
      onClick={stopNav}
    >
      {tape.user.profileImg ? (
        <img
          src={resolveVoiceAssetUrl(tape.user.profileImg)}
          alt={tape.user.name}
          className={`w-9 h-9 rounded-full object-cover flex-shrink-0 ${
            isOverlay ? "ring-2 ring-white/30" : ""
          }`}
        />
      ) : (
        <div
          className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center ${
            isOverlay ? "bg-white/20 ring-2 ring-white/30" : "bg-gray-200"
          }`}
        >
          <User className={`w-4 h-4 ${isOverlay ? "text-white/80" : "text-gray-500"}`} />
        </div>
      )}
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            isOverlay
              ? "text-white group-hover:text-white/80"
              : "text-gray-900 group-hover:text-gray-600"
          }`}
        >
          {displayName}
        </p>
        <p className={`text-xs truncate ${isOverlay ? "text-white/60" : "text-gray-400"}`}>
          Personal tape
        </p>
      </div>
    </Link>
  );
}
