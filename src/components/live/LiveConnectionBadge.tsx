"use client";

import React from "react";
import type { LiveConnectionState } from "@/types/live";

const LABELS: Record<LiveConnectionState, string> = {
  idle: "Preparing…",
  connecting: "Connecting…",
  connected: "Connected",
  ended: "Broadcast ended",
  error: "Connection error",
};

interface LiveConnectionBadgeProps {
  state: LiveConnectionState;
  role: "host" | "audience";
}

const LiveConnectionBadge = ({ state, role }: LiveConnectionBadgeProps) => {
  const label =
    state === "connected"
      ? role === "host"
        ? "You're live"
        : "Listening"
      : LABELS[state];

  return (
    <div
      className="flex items-center gap-2 text-sm text-gray-600"
      aria-live="polite"
    >
      <span
        className={`w-2 h-2 rounded-full ${
          state === "connected" ? "bg-gray-900" : "bg-gray-400"
        }`}
      />
      <span>{label}</span>
    </div>
  );
};

export default LiveConnectionBadge;
