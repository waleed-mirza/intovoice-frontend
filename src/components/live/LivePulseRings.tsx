"use client";

import React from "react";

interface LivePulseRingsProps {
  children: React.ReactNode;
  active?: boolean;
}

const LivePulseRings = ({ children, active = true }: LivePulseRingsProps) => (
  <div className="relative inline-flex items-center justify-center">
    {active && (
      <>
        <span
          className="absolute inset-0 rounded-full border-2 border-gray-300 live-ring-pulse"
          style={{ animation: "liveRingPulse 2s ease-out infinite" }}
        />
        <span
          className="absolute inset-0 rounded-full border-2 border-gray-400 live-ring-pulse"
          style={{ animation: "liveRingPulse 2s ease-out infinite 0.6s" }}
        />
        <span
          className="absolute inset-0 rounded-full border-2 border-gray-900 live-ring-pulse"
          style={{ animation: "liveRingPulse 2s ease-out infinite 1.2s" }}
        />
      </>
    )}
    <div className="relative z-10">{children}</div>
  </div>
);

export default LivePulseRings;
