/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import { useDrag } from "@use-gesture/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceRecorderOptions {
  isMicDisabled?: boolean;
  maxSeconds?: number;
  holdToRecordMs?: number;
  lockThresholdPx?: number;
  onPermissionDenied?: () => void;
}

interface UseVoiceRecorderSubmitState {
  isRecording: boolean;
  isPressingMic: boolean;
  isLocked: boolean;
  lockProgress: number;
  recordingSeconds: number;
  recordedBlob: Blob | null;
  recordedPreviewUrl: string | null;
  showMaxReachedTooltip: boolean;
  suppressSendSwap: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  discardVoice: () => Promise<void>;
  onStopLockedRecording: (options?: { force?: boolean }) => Promise<void>;
  micBind: ReturnType<typeof useDrag>;
  formatSeconds: (s: number) => string;
  triggerMaxReachedTooltip: () => void;
  resetAudioState: () => void;
}

const DEFAULT_MAX_SECONDS = 30;
const DEFAULT_HOLD_MS = 180;
const DEFAULT_LOCK_THRESHOLD = 50;

const useVoiceRecorder = (
  options: UseVoiceRecorderOptions = {}
): UseVoiceRecorderSubmitState => {
  const {
    isMicDisabled = false,
    maxSeconds = DEFAULT_MAX_SECONDS,
    holdToRecordMs = DEFAULT_HOLD_MS,
    lockThresholdPx = DEFAULT_LOCK_THRESHOLD,
    onPermissionDenied,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPressingMic, setIsPressingMic] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(
    null
  );
  const [showMaxReachedTooltip, setShowMaxReachedTooltip] = useState(false);
  const [suppressSendSwap, setSuppressSendSwap] = useState(false);

  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const ignoreCurrentGestureRef = useRef(false);
  const discardedAtRef = useRef<number>(0);
  const holdStartTimeoutRef = useRef<any>(null);
  const recorderSessionRef = useRef(0);
  const recordingTimerRef = useRef<any>(null);
  const maxDurationTimeoutRef = useRef<any>(null);
  const recordingStartedAtRef = useRef(0);
  const discardNextStopRef = useRef(false);
  const lockProgressRef = useRef(0);
  const lockedAtRef = useRef<number | null>(null);
  const gestureActiveRef = useRef(false);

  const suppressSendSwapFor = useCallback((ms: number) => {
    setSuppressSendSwap(true);
    setTimeout(() => setSuppressSendSwap(false), ms);
  }, []);

  const releaseGestureIgnoreSoon = useCallback((delay = 150) => {
    // Clear the ignore gate shortly after we intentionally set it, to avoid mobile-pointer stalls.
    setTimeout(() => {
      ignoreCurrentGestureRef.current = false;
    }, delay);
  }, []);

  const triggerMaxReachedTooltip = useCallback(() => {
    setShowMaxReachedTooltip(true);
    setTimeout(() => setShowMaxReachedTooltip(false), 2000);
  }, []);

  const clearRecordingTimers = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  }, []);

  const resetAudioState = useCallback(
    (options?: { keepGesture?: boolean; keepIgnore?: boolean }) => {
      clearRecordingTimers();
      if (holdStartTimeoutRef.current) {
        clearTimeout(holdStartTimeoutRef.current);
        holdStartTimeoutRef.current = null;
      }
      discardNextStopRef.current = false;
      stopResolveRef.current = null;
      lockedAtRef.current = null;
      recorderSessionRef.current += 1;

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];

      setIsRecording(false);
      setIsLocked(false);
      setIsPressingMic(false);
      setLockProgress(0);
      lockProgressRef.current = 0;
      if (!options?.keepGesture) {
        gestureActiveRef.current = false;
      }
      if (!options?.keepIgnore) {
        ignoreCurrentGestureRef.current = false;
      }
      setRecordingSeconds(0);
      setSuppressSendSwap(false);

      setRecordedBlob(null);
      setRecordedPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    },
    [clearRecordingTimers]
  );

  const lockRecording = useCallback(() => {
    setIsLocked(true);
    setLockProgress(1);
    lockProgressRef.current = 1;
    lockedAtRef.current = Date.now();
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    const isActuallyRecording = recorder?.state === "recording";
    if (!isRecording && !isActuallyRecording) return recordedBlob;

    return new Promise((resolve) => {
      const activeRecorder = mediaRecorderRef.current;
      if (!activeRecorder) {
        setIsRecording(false);
        setIsLocked(false);
        resolve(recordedBlob);
        return;
      }

      clearRecordingTimers();
      stopResolveRef.current = resolve;
      try {
        activeRecorder.stop();
      } catch {
        stopResolveRef.current = null;
        setIsRecording(false);
        setIsLocked(false);
        resolve(recordedBlob);
      }
    });
  }, [clearRecordingTimers, isRecording, recordedBlob]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    lockedAtRef.current = null;
    recorderSessionRef.current += 1;
    const sessionId = recorderSessionRef.current;

    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
      setRecordedPreviewUrl(null);
    }
    setRecordedBlob(null);
    setIsLocked(false);
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredMimeTypes.find((t) =>
        // @ts-ignore
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported
          ? MediaRecorder.isTypeSupported(t)
          : false
      );

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (sessionId !== recorderSessionRef.current) return;
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (sessionId !== recorderSessionRef.current) return;
        setIsPressingMic(false);
        lockedAtRef.current = null;
        gestureActiveRef.current = false;

        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = chunks.length
          ? new Blob(chunks, { type: blobType })
          : null;

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }

        setIsRecording(false);
        setIsLocked(false);

        clearRecordingTimers();

        const finalSeconds = Math.min(
          maxSeconds,
          Math.max(1, Math.floor((performance.now() - recordingStartedAtRef.current) / 1000))
        );
        setRecordingSeconds(finalSeconds);

        const shouldDiscard = discardNextStopRef.current;
        if (shouldDiscard) {
          discardNextStopRef.current = false;
        }

        if (blob && !shouldDiscard) {
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedPreviewUrl(url);
          suppressSendSwapFor(350);
        }

        if (stopResolveRef.current) {
          stopResolveRef.current(shouldDiscard ? null : blob);
          stopResolveRef.current = null;
        }
      };

      recorder.start(250);
      setIsRecording(true);
      recordingStartedAtRef.current = performance.now();

      const syncRecordingSeconds = () => {
        const elapsedMs = performance.now() - recordingStartedAtRef.current;
        const secs = Math.min(maxSeconds, Math.floor(elapsedMs / 1000));
        setRecordingSeconds(secs);
      };

      syncRecordingSeconds();
      recordingTimerRef.current = setInterval(syncRecordingSeconds, 250);

      maxDurationTimeoutRef.current = setTimeout(() => {
        maxDurationTimeoutRef.current = null;
        setRecordingSeconds(maxSeconds);
        stopRecording().then(() => {
          triggerMaxReachedTooltip();
        });
      }, maxSeconds * 1000);
    } catch (err: any) {
      if (onPermissionDenied) onPermissionDenied();
      resetAudioState();
    }
  }, [
    clearRecordingTimers,
    isRecording,
    maxSeconds,
    onPermissionDenied,
    recordedPreviewUrl,
    resetAudioState,
    stopRecording,
    triggerMaxReachedTooltip,
  ]);

  const micHoldTimeoutRef = holdStartTimeoutRef;

  const micBind = useDrag(
    ({ first, last, down, movement: [mx], event }) => {
      if (isMicDisabled) {
        return;
      }

      // Suppress long-press context menu on touch-like pointers.
      const isTouchLike = !!(
        event &&
        "pointerType" in event &&
        (event as PointerEvent).pointerType !== "mouse"
      );
      if (isTouchLike && event?.preventDefault) {
        event.preventDefault();
      }

      if (ignoreCurrentGestureRef.current) {
        // When recovering from a cancelled gesture (mobile), allow the very next pointer to proceed.
        ignoreCurrentGestureRef.current = false;
      }

      const handleGestureStart = () => {
        // Cooldown after a discard/stop to avoid accidental auto-start from stray touch events.
        if (Date.now() - discardedAtRef.current < 400) {
          return;
        }
        if (isRecording && isLocked) {
          return;
        }
        if (isRecording) {
          return;
        }

        gestureActiveRef.current = true;

        resetAudioState({ keepGesture: true });

        if (recordedPreviewUrl) {
          URL.revokeObjectURL(recordedPreviewUrl);
          setRecordedPreviewUrl(null);
        }
        if (recordedBlob) {
          setRecordedBlob(null);
        }
        setRecordingSeconds(0);

        setIsPressingMic(true);
        setIsLocked(false);
        setLockProgress(0);
        lockProgressRef.current = 0;
        if (holdStartTimeoutRef.current) {
          clearTimeout(holdStartTimeoutRef.current);
          holdStartTimeoutRef.current = null;
        }

        micHoldTimeoutRef.current = setTimeout(() => {
          startRecording();
          micHoldTimeoutRef.current = null;
        }, holdToRecordMs);
      };

      if (first) {
        handleGestureStart();
      } else if (
        down &&
        !gestureActiveRef.current &&
        !isRecording &&
        !isLocked
      ) {
        // Recovery logic for missed 'first' events (e.g. due to remount)
        if (Date.now() - discardedAtRef.current < 500) {
          return;
        }

        // Check if buttons are actually pressed to avoid phantom drags
        const isMouse = event && "buttons" in event;
        if (isMouse && (event as MouseEvent).buttons === 0) {
          return;
        }

        handleGestureStart();
      }

      if (down) {
        const dx = Math.max(0, -mx);
        const progress = Math.max(0, Math.min(1, dx / lockThresholdPx));
        setLockProgress(progress);
        lockProgressRef.current = progress;
        if (progress >= 1 && !isLocked) {
          lockRecording();
        }
        return;
      }

      if (last) {
        if (!gestureActiveRef.current) {
          return;
        }
        setIsPressingMic(false);

        if (micHoldTimeoutRef.current) {
          clearTimeout(micHoldTimeoutRef.current);
          micHoldTimeoutRef.current = null;
          setLockProgress(0);
          lockProgressRef.current = 0;
          gestureActiveRef.current = false;
          return;
        }

        if (!isLocked) {
          const dx = Math.max(0, -mx);
          const progress = Math.max(0, Math.min(1, dx / lockThresholdPx));
          if (progress >= 1) {
            lockRecording();
            gestureActiveRef.current = false;
            return;
          }
          setLockProgress(progress);
          lockProgressRef.current = progress;
        }

        if (isLocked || lockProgressRef.current >= 1) {
          // Already locked — end the hold gesture without re-locking (would refresh cooldown).
          setIsPressingMic(false);
          gestureActiveRef.current = false;
          return;
        }

        const recorder = mediaRecorderRef.current;
        const isActuallyRecording = recorder?.state === "recording";
        if (!isRecording && !isActuallyRecording) {
          setLockProgress(0);
          lockProgressRef.current = 0;
          return;
        }

        setLockProgress(0);
        lockProgressRef.current = 0;
        suppressSendSwapFor(350);
        stopRecording();
        gestureActiveRef.current = false;
      }
    },
    {
      pointer: { capture: true },
      eventOptions: { passive: false },
      preventScroll: true,
    }
  );

  const cancelGesture = useCallback(() => {
    try {
      (micBind as any)?.cancel?.();
    } catch {
      // ignore
    }
    gestureActiveRef.current = false;
    ignoreCurrentGestureRef.current = false;
  }, [micBind]);

  const onStopLockedRecording = useCallback(async (options?: { force?: boolean }) => {
    if (
      !options?.force &&
      lockedAtRef.current &&
      Date.now() - lockedAtRef.current < 800
    ) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    const isActuallyRecording =
      isRecording || recorder?.state === "recording" || recorder?.state === "paused";
    if (!isActuallyRecording) {
      return;
    }
    await stopRecording();
    cancelGesture();
    gestureActiveRef.current = false;
    ignoreCurrentGestureRef.current = true;
    discardedAtRef.current = Date.now();
    if (micHoldTimeoutRef.current) {
      clearTimeout(micHoldTimeoutRef.current);
      micHoldTimeoutRef.current = null;
    }
    releaseGestureIgnoreSoon(250);
    setIsLocked(false);
    setLockProgress(0);
    lockProgressRef.current = 0;
    lockedAtRef.current = null;
  }, [cancelGesture, isRecording, releaseGestureIgnoreSoon, stopRecording]);

  const discardVoice = useCallback(async () => {
    const wasGestureActive = gestureActiveRef.current;
    if (micHoldTimeoutRef.current) {
      clearTimeout(micHoldTimeoutRef.current);
      micHoldTimeoutRef.current = null;
    }

    cancelGesture();

    // Kill any pending recording and wipe references before resetting React state.
    const recorder = mediaRecorderRef.current;
    const wasRecording = recorder?.state === "recording";
    const wasPaused = recorder?.state === "paused";

    // Prevent any late onstop/ondataavailable from mutating state after we discard.
    if (recorder) {
      recorder.ondataavailable = null as any;
      recorder.onstop = null as any;
    }

    if (wasRecording || wasPaused) {
      try {
        recorder?.stop();
      } catch {
        // ignore
      }
    }

    // Stop audio tracks proactively.
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }

    // Clear any pending promises waiting on stop.
    if (stopResolveRef.current) {
      stopResolveRef.current(null);
      stopResolveRef.current = null;
    }

    discardNextStopRef.current = false;
    recordedChunksRef.current = [];
    mediaRecorderRef.current = null;

    // Proactively clear lock/press state to avoid stale locks blocking the next recording
    setIsLocked(false);
    setLockProgress(0);
    lockProgressRef.current = 0;
    lockedAtRef.current = null;
    setIsPressingMic(false);
    ignoreCurrentGestureRef.current = true;
    gestureActiveRef.current = false;
    discardedAtRef.current = Date.now();

    // Fully reset; do not carry over ignore flags so the next touch-down is handled.
    resetAudioState({ keepIgnore: false, keepGesture: false });
    releaseGestureIgnoreSoon(200);
  }, [cancelGesture, releaseGestureIgnoreSoon, resetAudioState]);

  const formatSeconds = useCallback((s: number) => {
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${mm}:${ss}`;
  }, []);

  useEffect(() => {
    return () => {
      resetAudioState();
    };
  }, [resetAudioState]);

  return {
    isRecording,
    isPressingMic,
    isLocked,
    lockProgress,
    recordingSeconds,
    recordedBlob,
    recordedPreviewUrl,
    showMaxReachedTooltip,
    suppressSendSwap,
    startRecording,
    stopRecording,
    discardVoice,
    onStopLockedRecording,
    micBind,
    formatSeconds,
    triggerMaxReachedTooltip,
    resetAudioState,
  };
};

export default useVoiceRecorder;
