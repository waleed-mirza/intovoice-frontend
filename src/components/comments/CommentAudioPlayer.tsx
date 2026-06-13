"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause } from "@/components/voice/VoiceIcons";
import voice from "@/utils/voiceTheme";
import { formatDuration } from "@/utils/voiceHelpers";

interface CommentAudioPlayerProps {
  src: string;
}

export default function CommentAudioPlayer({ src }: CommentAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekingForDurationRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    seekingForDurationRef.current = false;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (d && isFinite(d)) {
        setDuration(d);
      } else {
        seekingForDurationRef.current = true;
        audio.currentTime = 1e9;
      }
    };

    const onDurationChange = () => {
      const d = audio.duration;
      if (d && isFinite(d)) {
        setDuration(d);
        if (seekingForDurationRef.current) {
          seekingForDurationRef.current = false;
          audio.currentTime = 0;
          setCurrentTime(0);
        }
      }
    };

    const onTimeUpdate = () => {
      if (seekingForDurationRef.current) return;
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.load();

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const safeDuration = duration > 0 ? duration : 0;
  const safeCurrentTime = Math.min(currentTime, safeDuration);
  const pct = safeDuration > 0 ? (safeCurrentTime / safeDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mt-2 min-w-0">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="w-8 h-8 flex-shrink-0 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5 text-white" />
        ) : (
          <Play className="w-3.5 h-3.5 text-white ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={safeDuration > 0 ? safeDuration : 100}
          step={0.01}
          value={safeCurrentTime}
          onChange={handleSeek}
          disabled={safeDuration === 0}
          className="w-full h-1 rounded-full appearance-none cursor-pointer disabled:opacity-40"
          style={{ background: voice.progressGradient(pct) }}
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>{formatDuration(safeCurrentTime)}</span>
          <span>{safeDuration > 0 ? formatDuration(safeDuration) : "--:--"}</span>
        </div>
      </div>
      <div className={`flex items-end gap-0.5 h-5 flex-shrink-0 ${playing ? "" : "opacity-30"}`}>
        {[2, 4, 3, 5, 2].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gray-700"
            style={{
              height: `${h * 3}px`,
              animation: playing
                ? `voiceCommentPulse 0.8s ease-in-out ${i * 0.15}s infinite alternate`
                : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
