"use client";

import { Dialog, Transition } from "@headlessui/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { formatDuration } from "@/utils/voiceHelpers";
import { trimAudioToRange } from "@/utils/trimAudioToRange";
import { Loader2, Plus, X } from "@/components/voice/VoiceIcons";

interface AudioTrimModalProps {
  isOpen: boolean;
  file: File | null;
  /** Full source duration in seconds. */
  sourceDuration: number;
  /** Maximum allowed clip length in seconds. */
  maxDurationSeconds: number;
  title?: string;
  onClose: () => void;
  onComplete: (file: File, duration: number) => void | Promise<void>;
}

type DragHandle = "start" | "end" | "window" | "pan" | null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCapLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/** Smallest useful viewport: enough room around the max clip to nudge handles. */
function minViewDuration(total: number, maxClip: number): number {
  return Math.min(total, Math.max(maxClip * 2.5, 8));
}

export default function AudioTrimModal({
  isOpen,
  file,
  sourceDuration,
  maxDurationSeconds,
  title = "Trim audio",
  onClose,
  onComplete,
}: AudioTrimModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<DragHandle>(null);
  const dragOffsetRef = useRef(0);
  const panOriginRef = useRef({ x: 0, viewStart: 0 });
  const rangeRef = useRef({ start: 0, end: 0 });
  const viewRef = useRef({ start: 0, duration: 0 });

  const [objectUrl, setObjectUrl] = useState("");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [viewStart, setViewStart] = useState(0);
  const [viewDuration, setViewDuration] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(0, sourceDuration);
  const maxClip = Math.min(maxDurationSeconds, total || maxDurationSeconds);
  const selectionLength = Math.max(0, end - start);
  const minView = minViewDuration(total, maxClip);
  const isZoomed = total > 0 && viewDuration > 0 && viewDuration < total - 0.05;

  rangeRef.current = { start, end };
  viewRef.current = { start: viewStart, duration: viewDuration };

  const setViewWindow = useCallback(
    (nextStart: number, nextDuration: number) => {
      const duration = clamp(nextDuration, minView, Math.max(minView, total));
      const startBound = clamp(nextStart, 0, Math.max(0, total - duration));
      setViewStart(startBound);
      setViewDuration(duration);
    },
    [minView, total]
  );

  const keepSelectionInView = useCallback(
    (s: number, e: number, duration = viewRef.current.duration) => {
      if (duration <= 0 || total <= 0) return;
      let vs = viewRef.current.start;
      const pad = Math.min(duration * 0.08, 2);
      if (s < vs + pad) vs = s - pad;
      if (e > vs + duration - pad) vs = e + pad - duration;
      setViewStart(clamp(vs, 0, Math.max(0, total - duration)));
    },
    [total]
  );

  useEffect(() => {
    if (!isOpen || !file) {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const initialEnd = Math.min(total, maxClip);
    const s = 0;
    const e = initialEnd > 0 ? initialEnd : maxClip;
    setStart(s);
    setEnd(e);
    setPlayhead(0);
    setIsPlaying(false);
    setSaving(false);
    setProgress(0);
    setError(null);

    const initialView =
      total > maxClip * 4 ? Math.min(total, Math.max(maxClip * 6, minView)) : total;
    const centered = clamp(s + (e - s) / 2 - initialView / 2, 0, Math.max(0, total - initialView));
    setViewStart(centered);
    setViewDuration(initialView);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [isOpen, file, total, maxClip, minView]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !objectUrl) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setPlayhead(t);
      const { end: rangeEnd } = rangeRef.current;
      if (t >= rangeEnd - 0.05) {
        audio.pause();
        audio.currentTime = rangeRef.current.start;
        setPlayhead(rangeRef.current.start);
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      audio.currentTime = rangeRef.current.start;
      setPlayhead(rangeRef.current.start);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [objectUrl]);

  const clientXToTime = useCallback((clientX: number): number => {
    const track = trackRef.current;
    const { start: vs, duration: vd } = viewRef.current;
    if (!track || vd <= 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return vs + ratio * vd;
  }, []);

  const timeToPct = useCallback(
    (time: number): number => {
      if (viewDuration <= 0) return 0;
      return ((time - viewStart) / viewDuration) * 100;
    },
    [viewDuration, viewStart]
  );

  const applyStart = useCallback(
    (nextStart: number) => {
      const maxStart = Math.max(0, total - 0.5);
      let s = clamp(nextStart, 0, maxStart);
      let e = rangeRef.current.end;
      if (e - s > maxClip) e = s + maxClip;
      if (e - s < 0.5) e = Math.min(total, s + 0.5);
      if (e > total) {
        e = total;
        s = Math.max(0, e - maxClip);
      }
      setStart(s);
      setEnd(e);
      setPlayhead(s);
      if (audioRef.current) audioRef.current.currentTime = s;
      keepSelectionInView(s, e);
    },
    [keepSelectionInView, maxClip, total]
  );

  const applyEnd = useCallback(
    (nextEnd: number) => {
      let e = clamp(nextEnd, 0.5, total);
      let s = rangeRef.current.start;
      if (e - s > maxClip) s = e - maxClip;
      if (e - s < 0.5) s = Math.max(0, e - 0.5);
      if (s < 0) {
        s = 0;
        e = Math.min(total, s + maxClip);
      }
      setStart(s);
      setEnd(e);
      if (playhead < s || playhead > e) {
        setPlayhead(s);
        if (audioRef.current) audioRef.current.currentTime = s;
      }
      keepSelectionInView(s, e);
    },
    [keepSelectionInView, maxClip, playhead, total]
  );

  const applyWindow = useCallback(
    (nextStart: number) => {
      const length = rangeRef.current.end - rangeRef.current.start;
      const s = clamp(nextStart, 0, Math.max(0, total - length));
      const e = s + length;
      setStart(s);
      setEnd(e);
      setPlayhead(s);
      if (audioRef.current) audioRef.current.currentTime = s;
      keepSelectionInView(s, e);
    },
    [keepSelectionInView, total]
  );

  const onPointerMove = useCallback(
    (clientX: number) => {
      const handle = dragHandleRef.current;
      if (!handle) return;

      if (handle === "pan") {
        const track = trackRef.current;
        if (!track || viewRef.current.duration <= 0) return;
        const rect = track.getBoundingClientRect();
        const deltaRatio = (clientX - panOriginRef.current.x) / rect.width;
        const deltaTime = deltaRatio * viewRef.current.duration;
        setViewStart(
          clamp(
            panOriginRef.current.viewStart - deltaTime,
            0,
            Math.max(0, total - viewRef.current.duration)
          )
        );
        return;
      }

      const t = clientXToTime(clientX);
      if (handle === "start") applyStart(t);
      else if (handle === "end") applyEnd(t);
      else if (handle === "window") applyWindow(t - dragOffsetRef.current);
    },
    [applyEnd, applyStart, applyWindow, clientXToTime, total]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onMove = (e: PointerEvent) => {
      if (!dragHandleRef.current) return;
      e.preventDefault();
      onPointerMove(e.clientX);
    };

    const onUp = () => {
      dragHandleRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isOpen, onPointerMove]);

  const beginDrag = (handle: DragHandle, e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragHandleRef.current = handle;
    if (handle === "window") {
      dragOffsetRef.current = clientXToTime(e.clientX) - start;
    }
    if (handle === "pan") {
      panOriginRef.current = { x: e.clientX, viewStart };
    }
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const zoomByFactor = (factor: number, anchorTime?: number) => {
    if (total <= 0) return;
    const anchor =
      typeof anchorTime === "number"
        ? anchorTime
        : (rangeRef.current.start + rangeRef.current.end) / 2;
    const nextDuration = clamp(viewRef.current.duration * factor, minView, total);
    const ratio =
      viewRef.current.duration > 0
        ? (anchor - viewRef.current.start) / viewRef.current.duration
        : 0.5;
    setViewWindow(anchor - ratio * nextDuration, nextDuration);
  };

  const zoomIn = () => zoomByFactor(0.65);
  const zoomOut = () => zoomByFactor(1.55);

  const onTrackWheel = (e: ReactWheelEvent) => {
    if (saving || total <= 0) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomByFactor(e.deltaY > 0 ? 1.15 : 0.87, clientXToTime(e.clientX));
      return;
    }
    if (!isZoomed || viewDuration <= 0) return;
    e.preventDefault();
    const delta = (e.deltaY / 240) * viewDuration;
    setViewStart(clamp(viewStart + delta, 0, Math.max(0, total - viewDuration)));
  };

  const togglePreview = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (audio.currentTime < start || audio.currentTime >= end - 0.05) {
      audio.currentTime = start;
      setPlayhead(start);
    }
    try {
      await audio.play();
      setIsPlaying(true);
      keepSelectionInView(start, end);
    } catch {
      setError("Could not play preview. Try again.");
    }
  };

  const handleSave = async () => {
    if (!file || selectionLength < 0.5) return;
    if (selectionLength > maxDurationSeconds + 0.05) {
      setError(`Selection must be ${formatCapLabel(maxDurationSeconds)} or less`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setProgress(0);
      audioRef.current?.pause();
      setIsPlaying(false);

      // Leave a tiny margin so encoder padding doesn't push past the hard cap.
      const trimEnd = Math.min(end, start + maxDurationSeconds - 0.05);
      const result = await trimAudioToRange(file, start, Math.max(start + 0.5, trimEnd), setProgress);
      const cappedDuration = Math.min(result.duration, maxDurationSeconds);
      if (cappedDuration <= 0) {
        throw new Error("Trimmed clip has no duration");
      }
      await onComplete(result.file, cappedDuration);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : typeof err === "string" && err.trim()
            ? err
            : "Could not trim this file. Try again or use a shorter MP3.";
      setError(message);
      console.error("[AudioTrimModal] trim failed:", err);
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const handleDismiss = () => {
    if (saving) return;
    audioRef.current?.pause();
    onClose();
  };

  const startPct = timeToPct(start);
  const endPct = timeToPct(end);
  const playheadPct = timeToPct(playhead);
  const overCap = selectionLength > maxDurationSeconds + 0.05;
  const canZoomIn = viewDuration > minView + 0.05;
  const canZoomOut = viewDuration < total - 0.05;

  const overviewStartPct = total > 0 ? (start / total) * 100 : 0;
  const overviewEndPct = total > 0 ? (end / total) * 100 : 0;
  const overviewViewLeft = total > 0 ? (viewStart / total) * 100 : 0;
  const overviewViewWidth = total > 0 ? (viewDuration / total) * 100 : 100;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[120]" onClose={handleDismiss}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-neutral-950/55" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-5">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-250"
              enterFrom="opacity-0 translate-y-8 sm:translate-y-3 sm:scale-[0.98]"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-8 sm:translate-y-3 sm:scale-[0.98]"
            >
              <Dialog.Panel className="w-full sm:max-w-md transform overflow-hidden rounded-t-[1.75rem] sm:rounded-[1.75rem] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-all">
                {/* Header — brand-quiet, one job */}
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
                  <div className="min-w-0">
                    <Dialog.Title className="text-[1.35rem] font-semibold tracking-tight text-neutral-950 leading-none">
                      {title}
                    </Dialog.Title>
                    <p className="mt-2 text-sm text-neutral-500">
                      Pick up to {formatCapLabel(maxDurationSeconds)} from{" "}
                      <span className="tabular-nums text-neutral-700">
                        {formatDuration(total)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    disabled={saving}
                    className="mt-0.5 p-2 -mr-1 text-neutral-400 hover:text-neutral-800 rounded-full hover:bg-neutral-100 transition-colors disabled:opacity-40"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-5 pt-6 pb-2">
                  {objectUrl && (
                    <audio ref={audioRef} src={objectUrl} preload="metadata" className="hidden" />
                  )}

                  {/* Selection readout + play — single focal row */}
                  <div className="flex items-end justify-between gap-4 mb-5">
                    <div>
                      <p
                        className={`text-[2rem] leading-none font-semibold tracking-tight tabular-nums ${
                          overCap ? "text-red-600" : "text-neutral-950"
                        }`}
                      >
                        {formatDuration(selectionLength)}
                      </p>
                      <p className="mt-1.5 text-sm tabular-nums text-neutral-500">
                        {formatDuration(start)}
                        <span className="mx-1.5 text-neutral-300">→</span>
                        {formatDuration(end)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={togglePreview}
                      disabled={saving || !objectUrl}
                      aria-label={isPlaying ? "Pause preview" : "Preview selection"}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
                        isPlaying
                          ? "bg-neutral-950 text-white scale-[1.02]"
                          : "bg-neutral-950 text-white hover:bg-neutral-800"
                      }`}
                    >
                      {isPlaying ? (
                        <span className="flex gap-1">
                          <span className="w-1 h-4 bg-current rounded-sm" />
                          <span className="w-1 h-4 bg-current rounded-sm" />
                        </span>
                      ) : (
                        <span
                          className="ml-0.5 w-0 h-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-current"
                          aria-hidden
                        />
                      )}
                    </button>
                  </div>

                  {/* Timeline — the only interactive surface that matters */}
                  <div
                    ref={trackRef}
                    className={`relative h-16 select-none touch-none rounded-2xl bg-neutral-100 overflow-hidden ${
                      isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                    }`}
                    onWheel={onTrackWheel}
                    onPointerDown={(e) => {
                      if (saving) return;
                      const t = clientXToTime(e.clientX);
                      if (t >= start && t <= end) {
                        beginDrag("window", e);
                        return;
                      }
                      if (isZoomed) {
                        beginDrag("pan", e);
                        return;
                      }
                      if (t < start) beginDrag("start", e);
                      else beginDrag("end", e);
                    }}
                  >
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-1 rounded-full bg-neutral-300/80" />
                    {startPct < endPct && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-neutral-950 transition-[left,width] duration-75"
                        style={{
                          left: `${clamp(startPct, 0, 100)}%`,
                          width: `${clamp(
                            endPct - startPct,
                            0,
                            100 - clamp(startPct, 0, 100)
                          )}%`,
                        }}
                      />
                    )}
                    {playheadPct >= -2 && playheadPct <= 102 && (
                      <div
                        className="absolute top-3 bottom-3 w-[2px] bg-amber-500 pointer-events-none z-10 rounded-full"
                        style={{ left: `${clamp(playheadPct, 0, 100)}%` }}
                      />
                    )}
                    {startPct >= -4 && startPct <= 104 && (
                      <button
                        type="button"
                        aria-label="Trim start"
                        disabled={saving}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-12 rounded-full bg-white border-[1.5px] border-neutral-950 shadow-[0_2px_8px_rgba(0,0,0,0.12)] z-20 cursor-ew-resize disabled:opacity-50"
                        style={{ left: `${clamp(startPct, 0, 100)}%` }}
                        onPointerDown={(e) => beginDrag("start", e)}
                      />
                    )}
                    {endPct >= -4 && endPct <= 104 && (
                      <button
                        type="button"
                        aria-label="Trim end"
                        disabled={saving}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-12 rounded-full bg-white border-[1.5px] border-neutral-950 shadow-[0_2px_8px_rgba(0,0,0,0.12)] z-20 cursor-ew-resize disabled:opacity-50"
                        style={{ left: `${clamp(endPct, 0, 100)}%` }}
                        onPointerDown={(e) => beginDrag("end", e)}
                      />
                    )}
                  </div>

                  {/* Quiet tools: zoom + filmstrip */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
                      <button
                        type="button"
                        onClick={zoomOut}
                        disabled={saving || !canZoomOut}
                        aria-label="Zoom out"
                        className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-700 text-lg leading-none hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={zoomIn}
                        disabled={saving || !canZoomIn}
                        aria-label="Zoom in"
                        className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={saving || total <= 0}
                      aria-label="Jump in file"
                      className="relative flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden disabled:opacity-40"
                      onClick={(e) => {
                        if (saving || total <= 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
                        setViewWindow(ratio * total - viewDuration / 2, viewDuration);
                      }}
                    >
                      <div
                        className="absolute inset-y-0 bg-neutral-950/25"
                        style={{
                          left: `${overviewViewLeft}%`,
                          width: `${Math.max(6, overviewViewWidth)}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 bg-neutral-950"
                        style={{
                          left: `${overviewStartPct}%`,
                          width: `${Math.max(1.2, overviewEndPct - overviewStartPct)}%`,
                        }}
                      />
                    </button>
                  </div>

                  {saving && (
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between text-sm text-neutral-600">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {progress > 0 && progress < 100
                            ? "Capturing clip…"
                            : "Trimming…"}
                        </span>
                        <span className="tabular-nums text-neutral-400">{progress}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full bg-neutral-950 transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-neutral-400">
                        Long files are trimmed in real time — this can take up to a minute.
                      </p>
                    </div>
                  )}

                  {error && (
                    <p className="mt-4 text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5 px-5 pt-4 pb-5 sm:pb-5">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    disabled={saving}
                    className="flex-1 py-3.5 text-sm font-medium text-neutral-700 rounded-2xl hover:bg-neutral-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || overCap || selectionLength < 0.5 || !file}
                    className="flex-[1.4] py-3.5 text-sm font-semibold text-white bg-neutral-950 rounded-2xl hover:bg-neutral-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Trimming…
                      </>
                    ) : (
                      "Use clip"
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
