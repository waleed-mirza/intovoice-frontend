"use client";

import React from "react";
import Link from "next/link";

const LiveEmptyState = () => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
    <div className="relative w-24 h-24 mx-auto mb-6">
      <span
        className="absolute inset-0 rounded-full border-2 border-gray-200"
        style={{ animation: "liveRingPulse 2s ease-out infinite" }}
      />
      <span
        className="absolute inset-2 rounded-full border-2 border-gray-300"
        style={{ animation: "liveRingPulse 2s ease-out infinite 0.5s" }}
      />
      <span className="absolute inset-4 rounded-full bg-gray-100" />
    </div>
    <h2 className="text-lg font-semibold text-gray-900 mb-2">
      No one is live yet
    </h2>
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      Be the first voice in the room. Start an audio broadcast and let listeners
      join in real time.
    </p>
    <Link
      href="/live/go"
      className="inline-flex items-center justify-center px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
    >
      Go live
    </Link>
  </div>
);

export default LiveEmptyState;
