"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Volume2 } from "@/components/voice/VoiceIcons";

interface LiveListenerBarProps {
  onToggleVolume: () => void;
  onLeave: () => void;
}

const LiveListenerBar = ({ onToggleVolume, onLeave }: LiveListenerBarProps) => {
  const router = useRouter();

  const handleLeave = () => {
    onLeave();
    router.push("/live");
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
      <button
        type="button"
        onClick={onToggleVolume}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
      >
        <Volume2 className="w-4 h-4" />
        Toggle volume
      </button>
      <button
        type="button"
        onClick={handleLeave}
        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
      >
        Leave
      </button>
    </div>
  );
};

export default LiveListenerBar;
