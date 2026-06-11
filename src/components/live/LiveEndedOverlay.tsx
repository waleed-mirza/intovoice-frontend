"use client";

import React from "react";
import Link from "next/link";

const LiveEndedOverlay = () => (
  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10 p-6 text-center">
    <h2 className="text-lg font-semibold text-gray-900 mb-2">
      This broadcast has ended
    </h2>
    <p className="text-sm text-gray-600 mb-6">
      Thanks for listening. Check the live page for other broadcasts.
    </p>
    <Link
      href="/live"
      className="inline-flex items-center justify-center px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
    >
      Back to live
    </Link>
  </div>
);

export default LiveEndedOverlay;
