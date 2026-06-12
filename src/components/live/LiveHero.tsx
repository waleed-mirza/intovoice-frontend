"use client";

import React from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "@/components/voice/VoiceIcons";

interface LiveHeroProps {
  count: number;
  refreshing?: boolean;
  hasActiveStream?: boolean;
  activeStreamId?: string | null;
  onRefresh?: () => void;
}

const LiveHero = ({
  count,
  refreshing = false,
  hasActiveStream = false,
  activeStreamId,
  onRefresh,
}: LiveHeroProps) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Live now</h1>
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-voice-badge-bg text-voice-badge-text text-sm font-medium">
          {count} on air
        </span>
      </div>
    </div>

    <div className="flex items-center gap-2 self-start sm:self-auto">
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50"
          aria-label="Refresh live streams"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      )}

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
  </div>
);

export default LiveHero;
