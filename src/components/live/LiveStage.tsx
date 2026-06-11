"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Waveform from "@/components/voice/Waveform";
import type { LiveStream } from "@/types/live";
import type { LiveConnectionState } from "@/types/live";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import LivePulseRings from "./LivePulseRings";
import LiveConnectionBadge from "./LiveConnectionBadge";

interface LiveStageProps {
  stream: LiveStream;
  connectionState: LiveConnectionState;
  role: "host" | "audience";
  isPlaying?: boolean;
}

const formatElapsed = (startedAt: string) => {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
};

const LiveStage = ({
  stream,
  connectionState,
  role,
  isPlaying = false,
}: LiveStageProps) => {
  const [elapsed, setElapsed] = useState(formatElapsed(stream.startedAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatElapsed(stream.startedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [stream.startedAt]);

  const avatarUrl = stream.station?.avatarURL
    ? resolveVoiceAssetUrl(stream.station.avatarURL)
    : stream.user.profileImg
      ? resolveVoiceAssetUrl(stream.user.profileImg)
      : null;

  const displayName = stream.station?.name || stream.user.name;
  const isLive = connectionState !== "ended";

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 text-white text-xs font-medium uppercase tracking-wide">
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400"
            style={
              isLive
                ? { animation: "voiceCommentPulse 1s ease-in-out infinite alternate" }
                : undefined
            }
          />
          Live
        </span>
        <span className="text-sm text-gray-500 font-mono">{elapsed}</span>
      </div>

      <div className="flex flex-col items-center text-center">
        <LivePulseRings active={isLive && connectionState === "connected"}>
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-500">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </LivePulseRings>

        <h1 className="mt-5 text-xl font-semibold text-gray-900">{stream.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{stream.user.name}</p>

        {stream.station && (
          <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-voice-badge-bg text-voice-badge-text text-xs">
            {stream.station.name}
          </span>
        )}

        {stream.description && (
          <p className="mt-3 text-sm text-gray-600 max-w-md">{stream.description}</p>
        )}

        <div className="mt-4">
          <LiveConnectionBadge state={connectionState} role={role} />
        </div>

        <div className="w-full mt-6 bg-gray-50 rounded-xl p-4 h-24 flex items-center justify-center">
          <Waveform
            isPlaying={
              role === "host"
                ? connectionState === "connected"
                : isPlaying && connectionState === "connected"
            }
          />
        </div>
      </div>
    </div>
  );
};

export default LiveStage;
