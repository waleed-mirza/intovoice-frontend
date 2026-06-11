"use client";

import React from "react";
import Link from "next/link";
import { Loader2 } from "@/components/voice/VoiceIcons";

interface LiveHeroProps {
  count: number;
  refreshing?: boolean;
  hasActiveStream?: boolean;
  activeStreamId?: string | null;
}

const LiveHero = ({
  count,
  refreshing = false,
  hasActiveStream = false,
  activeStreamId,
}: LiveHeroProps) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Live now</h1>
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-voice-badge-bg text-voice-badge-text text-sm font-medium">
          {count} on air
        </span>
        {refreshing && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>
    </div>

    {hasActiveStream && activeStreamId ? (
      <Link
        href={`/live/${activeStreamId}?role=host`}
        className="inline-flex items-center justify-center px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
      >
        Resume broadcast
      </Link>
    ) : (
      <Link
        href="/live/go"
        className="inline-flex items-center justify-center px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
      >
        Go live
      </Link>
    )}
  </div>
);

export default LiveHero;
