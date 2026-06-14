"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX } from "@/components/voice/VoiceIcons";
import Waveform from "@/components/voice/Waveform";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { formatDuration } from "@/utils/voiceHelpers";
import { TAPE_PLAYER_CLASS, TAPE_PLAYER_WRAP } from "@/utils/tapeLayout";
import TapeCreatorBadge from "./TapeCreatorBadge";
import TapeActionRail from "./TapeActionRail";
import TapeCommentsPanel from "./TapeCommentsPanel";
import type { Tape } from "@/types/tapes";

interface TapeSlideProps {
  tape: Tape;
  isActive: boolean;
  commentsOpen: boolean;
  onTapeUpdate: (tapeId: string, updates: Partial<Tape>) => void;
  onToggleComments: (tapeId: string) => void;
  onCloseComments: () => void;
  onCommentCountChange: (delta: number) => void;
  onView: (tapeId: string) => void;
  onTapeDelete?: (tapeId: string) => void;
}

function stopBubble(e: React.SyntheticEvent) {
  e.stopPropagation();
}

const TAPE_VOLUME_KEY = "tape_volume";

function readStoredVolume(): number {
  if (typeof window === "undefined") return 1;
  try {
    const saved = localStorage.getItem(TAPE_VOLUME_KEY);
    if (saved == null) return 1;
    const v = parseFloat(saved);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export default function TapeSlide({
  tape,
  isActive,
  commentsOpen,
  onTapeUpdate,
  onToggleComments,
  onCloseComments,
  onCommentCountChange,
  onView,
  onTapeDelete,
}: TapeSlideProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ startY: 0, startX: 0, moved: false });
  const volumeBeforeMuteRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(tape.duration);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [playerColumnHeight, setPlayerColumnHeight] = useState<number | null>(null);

  useEffect(() => {
    const stored = readStoredVolume();
    setVolume(stored);
    volumeBeforeMuteRef.current = stored || 1;
  }, []);

  useEffect(() => {
    const el = playerWrapRef.current;
    if (!el) return;

    const updateHeight = () => {
      setPlayerColumnHeight(el.getBoundingClientRect().height);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tape.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
  }, [volume, isMuted, isActive]);

  useEffect(() => {
    if (!volumeOpen) return;
    const close = (e: PointerEvent) => {
      if (volumeRef.current?.contains(e.target as Node)) return;
      setVolumeOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [volumeOpen]);

  useEffect(() => {
    if (isActive) {
      onView(tape.id);
    } else {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive, tape.id, onView]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isActive) return;

    let rafId = 0;

    const tick = () => {
      setCurrentTime(audio.currentTime);
      rafId = requestAnimationFrame(tick);
    };

    const startProgressLoop = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    const stopProgressLoop = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const tryPlay = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    tryPlay();

    const onLoaded = () => setDuration(audio.duration || tape.duration);
    const onPlay = () => {
      setIsPlaying(true);
      startProgressLoop();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopProgressLoop();
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    if (!audio.paused) {
      startProgressLoop();
    }

    return () => {
      stopProgressLoop();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [isActive, tape.id, tape.duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const handlePlayerTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchRef.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      moved: false,
    };
  };

  const handlePlayerTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = Math.abs(touch.clientY - touchRef.current.startY);
    const deltaX = Math.abs(touch.clientX - touchRef.current.startX);
    if (deltaY > 10 || deltaX > 10) {
      touchRef.current.moved = true;
    }
  };

  const handlePlayerClick = () => {
    if (touchRef.current.moved) return;
    togglePlay();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v = parseFloat(e.target.value);
    setVolume(v);
    volumeBeforeMuteRef.current = v || volumeBeforeMuteRef.current;
    try {
      localStorage.setItem(TAPE_VOLUME_KEY, String(v));
    } catch {
      // ignore
    }
    if (v === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted || volume === 0) {
      const restore = volumeBeforeMuteRef.current > 0 ? volumeBeforeMuteRef.current : 0.8;
      setVolume(restore);
      setIsMuted(false);
      try {
        localStorage.setItem(TAPE_VOLUME_KEY, String(restore));
      } catch {
        // ignore
      }
    } else {
      volumeBeforeMuteRef.current = volume;
      setIsMuted(true);
    }
  };

  const handleVolumeButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.matchMedia("(max-width: 767px)").matches) {
      setVolumeOpen((open) => !open);
      return;
    }
    toggleMute(e);
  };

  const sliderValue = isMuted ? 0 : volume;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const railProps = {
    tape,
    variant: "rail" as const,
    commentsOpen,
    onTapeUpdate: (updates: Partial<Tape>) => onTapeUpdate(tape.id, updates),
    onOpenComments: () => onToggleComments(tape.id),
    onTapeDelete,
  };

  const showDesktopEmbeddedComments = commentsOpen && isActive;

  return (
    <div
      className={`flex flex-1 min-h-0 w-full h-full ${
        showDesktopEmbeddedComments ? "" : "md:items-center"
      }`}
    >
      <div
        className={`flex flex-1 min-h-0 w-full mx-auto items-stretch ${
          showDesktopEmbeddedComments
            ? "md:items-start md:max-w-[min(100%,52rem)] lg:max-w-[min(100%,58rem)] md:px-4 md:py-6 lg:py-8"
            : "md:items-center md:justify-center md:px-4 md:py-6 lg:py-8"
        }`}
      >
        <div
          className={`flex min-h-0 w-full gap-0 md:gap-4 items-stretch ${
            showDesktopEmbeddedComments
              ? "md:items-start md:max-w-full"
              : "md:items-center md:justify-center md:max-w-[min(100%,28rem)] md:mx-auto"
          }`}
        >
          {/* Player column */}
          <div className={TAPE_PLAYER_WRAP} ref={playerWrapRef}>
            <div
              className={TAPE_PLAYER_CLASS}
              onClick={handlePlayerClick}
              onTouchStart={handlePlayerTouchStart}
              onTouchMove={handlePlayerTouchMove}
            >
              <audio
                ref={audioRef}
                src={resolveVoiceAssetUrl(tape.audioURL)}
                preload="metadata"
                className="hidden"
                playsInline
                loop
              />

              {!imgError && tape.thumbnailURL ? (
                <img
                  src={resolveVoiceAssetUrl(tape.thumbnailURL)}
                  alt={tape.caption}
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                    isPlaying ? "opacity-35 scale-[1.02]" : "opacity-100 scale-100"
                  }`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <Play className="w-12 h-12 text-gray-500 ml-1" />
                </div>
              )}

              <div
                className={`absolute inset-x-0 top-[42%] -translate-y-1/2 z-10 h-[65px] transition-opacity duration-500 pointer-events-none ${
                  isPlaying ? "opacity-80" : "opacity-0"
                }`}
              >
                <Waveform isPlaying={isPlaying} color="#ffffff" maxHeightRatio={0.55} />
              </div>

              {/* Desktop hover controls */}
              <div
                className="absolute top-0 inset-x-0 z-20 hidden md:flex items-center justify-between p-2.5 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={stopBubble}
              >
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                <div
                  ref={volumeRef}
                  className="group/vol relative flex items-center gap-1"
                  onPointerDown={stopBubble}
                >
                  <div
                    className="flex items-center rounded-full bg-black/40 backdrop-blur-sm w-0 opacity-0 overflow-hidden px-0 pointer-events-none group-hover/vol:w-[5.5rem] group-hover/vol:opacity-100 group-hover/vol:px-2 group-hover/vol:py-1 group-hover/vol:pointer-events-auto group-hover/vol:overflow-visible transition-all duration-200"
                  >
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sliderValue}
                      onChange={handleVolumeChange}
                      onPointerDown={stopBubble}
                      aria-label="Volume"
                      className="tape-volume-slider h-1 w-full min-w-[4.5rem] cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVolumeButtonClick}
                    className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    aria-label={isMuted ? "Unmute" : "Adjust volume"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile: volume control (tap video to play/pause) */}
              <div
                className="absolute top-0 inset-x-0 z-20 flex items-center justify-end p-2.5 md:hidden"
                onClick={stopBubble}
              >
                <div
                  ref={volumeRef}
                  className="relative flex items-center gap-1"
                  onPointerDown={stopBubble}
                >
                  <div
                    className={`flex items-center rounded-full bg-black/50 backdrop-blur-sm transition-all duration-200 ${
                      volumeOpen
                        ? "w-[5.5rem] opacity-100 px-2 py-1"
                        : "w-0 opacity-0 overflow-hidden px-0 pointer-events-none"
                    }`}
                  >
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sliderValue}
                      onChange={handleVolumeChange}
                      onPointerDown={stopBubble}
                      aria-label="Volume"
                      className="tape-volume-slider h-1 w-full min-w-[4.5rem] cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVolumeButtonClick}
                    className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
                    aria-label={isMuted ? "Unmute" : "Adjust volume"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {!isPlaying && (
                <div className="absolute inset-0 z-[15] hidden md:flex items-center justify-center pointer-events-none">
                  <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                    <Play className="w-7 h-7 text-white ml-1" />
                  </span>
                </div>
              )}

              <div
                className="absolute inset-x-0 bottom-0 z-20 pointer-events-none md:bottom-0"
              >
                {/* Caption / metadata — keep clear of action rail on mobile */}
                <div
                  className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 pb-2 pl-3 pr-[4.5rem] md:px-3 md:pb-3"
                >
                  <div className="pointer-events-auto mb-1.5">
                    <TapeCreatorBadge tape={tape} variant="overlay" />
                  </div>
                  <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-1 drop-shadow-sm">
                    {tape.caption}
                  </p>
                  <p className="text-[11px] text-white/70 tabular-nums">
                    {tape.viewCount.toLocaleString()} listens
                    <span className="mx-1.5">·</span>
                    {formatDuration(duration)}
                  </p>
                </div>

                {/* Mobile-only full-width seekbar inside player */}
                <div
                  className="md:hidden bg-gradient-to-t from-black/90 to-black/50 pt-2 pb-3"
                >
                  <div className="pointer-events-auto">
                    <div className="h-1 w-full bg-white/25 overflow-hidden">
                      <div
                        className="h-full bg-white will-change-[width]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] tabular-nums text-white/60 px-3">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile: TikTok-style action rail overlaid on tape */}
              {isActive && (
                <div
                  className="absolute inset-y-0 right-3 z-40 md:hidden flex flex-col items-center justify-end pb-[9.5rem] pointer-events-none"
                >
                  <div
                    className="pointer-events-auto"
                    onClick={stopBubble}
                    onTouchStart={stopBubble}
                  >
                    <TapeActionRail {...railProps} theme="overlay" compact />
                  </div>
                </div>
              )}
            </div>

            {/* Desktop: seekbar below player card */}
            <div className="hidden md:block mt-2.5 w-full flex-shrink-0">
              <div className="h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-900 will-change-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-gray-500 px-0.5">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
          </div>

          {/* Desktop: action rail between player and comments */}
          {isActive && (
            <div
              className="hidden md:flex flex-col justify-center flex-shrink-0 self-center"
              style={
                showDesktopEmbeddedComments && playerColumnHeight
                  ? { height: playerColumnHeight }
                  : undefined
              }
              onClick={stopBubble}
              onTouchStart={stopBubble}
            >
              <TapeActionRail {...railProps} theme="default" />
            </div>
          )}

          {/* Desktop: inline comments beside player */}
          {showDesktopEmbeddedComments && playerColumnHeight != null && (
            <div
              className="hidden md:flex flex-shrink-0 self-start min-h-0 overflow-hidden"
              style={{ height: playerColumnHeight }}
            >
              <TapeCommentsPanel
                variant="embedded"
                tape={tape}
                onClose={onCloseComments}
                onCommentCountChange={onCommentCountChange}
              />
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .tape-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #fff;
          cursor: pointer;
        }
        .tape-volume-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border: none;
          border-radius: 9999px;
          background: #fff;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
