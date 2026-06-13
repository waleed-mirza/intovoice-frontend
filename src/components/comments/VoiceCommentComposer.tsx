"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import { Loader2, Mic, X } from "@/components/voice/VoiceIcons";
import CommentAudioPlayer from "@/components/comments/CommentAudioPlayer";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import type { ReplyTarget } from "@/components/comments/voiceCommentTypes";

const MAX_RECORDING_SECONDS = 59;
const HOLD_TO_RECORD_MS = 180;
const LOCK_THRESHOLD_PX = 50;

export interface VoiceCommentSubmitArgs {
  text: string;
  recordedBlob: Blob | null;
  isRecording: boolean;
  stopRecording: () => Promise<Blob | null>;
  recordingSeconds: number;
  onTooLong?: () => void;
}

interface VoiceCommentComposerProps {
  user: {
    id: string;
    name: string;
    profileImg?: string | null;
  } | null;
  userLoading: boolean;
  loginRedirect: string;
  replyingTo: ReplyTarget | null;
  onCancelReply: () => void;
  isSending: boolean;
  onSend: (args: VoiceCommentSubmitArgs) => Promise<boolean>;
  compact?: boolean;
}

export default function VoiceCommentComposer({
  user,
  userLoading,
  loginRedirect,
  replyingTo,
  onCancelReply,
  isSending,
  onSend,
  compact = false,
}: VoiceCommentComposerProps) {
  const [newComment, setNewComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, compact ? 96 : 160)}px`;
  };

  const {
    isRecording,
    isPressingMic,
    isLocked,
    lockProgress,
    recordingSeconds,
    recordedBlob,
    recordedPreviewUrl,
    showMaxReachedTooltip,
    suppressSendSwap,
    micBind,
    onStopLockedRecording,
    discardVoice,
    stopRecording,
    triggerMaxReachedTooltip,
    resetAudioState,
    formatSeconds,
  } = useVoiceRecorder({
    maxSeconds: MAX_RECORDING_SECONDS,
    holdToRecordMs: HOLD_TO_RECORD_MS,
    lockThresholdPx: LOCK_THRESHOLD_PX,
    isMicDisabled: newComment.trim().length > 0,
    onPermissionDenied: () => console.warn("Microphone permission denied"),
  });

  const hasText = newComment.trim().length > 0;
  const voiceReadyToSend = !!recordedBlob && !isRecording;
  const canSend = hasText || voiceReadyToSend;
  const sendDisabled = isSending || suppressSendSwap || isPressingMic || !canSend;
  /** Only swap the main action button to Send for typed comments — voice uses preview row controls */
  const showMainActionSend = !sendDisabled && hasText;

  const handleSend = async () => {
    if (userLoading || !user || sendDisabled) return;

    const ok = await onSend({
      text: newComment,
      recordedBlob,
      isRecording,
      stopRecording,
      recordingSeconds,
      onTooLong: triggerMaxReachedTooltip,
    });

    if (ok) {
      setNewComment("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      resetAudioState();
    }
  };

  const micHandlers = micBind();

  if (!user) {
    return (
      <Link
        href={loginRedirect}
        className="block text-center py-3 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
      >
        Sign in to leave a comment
      </Link>
    );
  }

  return (
    <div
      className={`transition-colors ${
        compact
          ? "p-0 border-0 bg-transparent"
          : `rounded-2xl border ${
              replyingTo ? "border-gray-400 ring-1 ring-gray-300" : "border-gray-200"
            } bg-gray-50 p-3`
      }`}
    >
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <p className="text-xs text-gray-600 truncate">
            Replying to{" "}
            <span className="font-semibold text-gray-900">{replyingTo.targetAuthorName}</span>
          </p>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          {user.profileImg ? (
            <img
              src={resolveVoiceAssetUrl(user.profileImg)}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold text-xs">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 relative min-w-0">
          <textarea
            ref={textareaRef}
            rows={1}
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              resizeTextarea();
            }}
            disabled={!!recordedBlob}
            placeholder={
              isRecording
                ? "Recording…"
                : recordedBlob
                  ? "Voice recorded — listen below, then post or discard"
                  : replyingTo
                    ? `Reply to ${replyingTo.targetAuthorName}…`
                    : "Add a comment…"
            }
            maxLength={1000}
            className={`w-full px-3 py-2.5 rounded-full text-sm border transition-all resize-none overflow-y-auto min-h-[40px] leading-5 focus:outline-none focus:ring-2 focus:ring-gray-300 ${
              compact ? "max-h-24" : "max-h-40"
            } ${
              recordedBlob
                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-white border-gray-300"
            }`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>

        <div className="relative flex-shrink-0 w-9 h-9">
          {showMaxReachedTooltip && (
            <div className="absolute -top-10 right-0 text-[11px] text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm z-10 whitespace-nowrap">
              Max {MAX_RECORDING_SECONDS}s reached
            </div>
          )}

          {isRecording && !isLocked && (
            <div className="absolute bottom-full mb-2 right-0 flex items-center gap-1.5 pointer-events-none z-10">
              <div className="text-[10px] text-gray-600 bg-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                ← Slide to lock
              </div>
              <div className="w-8 h-1 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-gray-800 transition-all duration-100"
                  style={{ width: `${Math.round(lockProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {!showMainActionSend ? (
            isRecording && isLocked ? (
              <button
                type="button"
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onStopLockedRecording({ force: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void onStopLockedRecording({ force: true });
                  }
                }}
                disabled={isSending}
                className={`absolute inset-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 bg-red-500 text-white shadow-lg scale-110 ${
                  isSending ? "opacity-60 cursor-not-allowed" : ""
                }`}
                aria-label="Stop recording"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 6a1 1 0 011-1h6a1 1 0 011 1v8a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                {...micHandlers}
                onTouchStart={(e) => {
                  micHandlers.onPointerDown?.(e as unknown as React.PointerEvent);
                }}
                onTouchMove={(e) => {
                  micHandlers.onPointerMove?.(e as unknown as React.PointerEvent);
                }}
                onTouchEnd={(e) => {
                  micHandlers.onPointerUp?.(e as unknown as React.PointerEvent);
                  if (isRecording && !isLocked) stopRecording();
                }}
                onPointerMove={(e) => {
                  micHandlers.onPointerMove?.(e);
                }}
                onPointerUp={(e) => {
                  micHandlers.onPointerUp?.(e);
                  if (isRecording && !isLocked) stopRecording();
                }}
                onPointerCancel={(e) => {
                  micHandlers.onPointerUp?.(e);
                  if (isRecording && !isLocked) stopRecording();
                }}
                disabled={isSending || hasText || voiceReadyToSend}
                style={{ touchAction: "none" }}
                onContextMenu={(e) => e.preventDefault()}
                className={`absolute inset-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isRecording
                    ? "bg-red-500 text-white shadow-lg scale-110"
                    : voiceReadyToSend || hasText
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-black hover:bg-gray-800 text-white shadow-md active:scale-95"
                } ${isSending ? "opacity-60 cursor-not-allowed" : ""}`}
                aria-label={
                  voiceReadyToSend
                    ? "Clear recording to record again"
                    : hasText
                      ? "Clear text to record"
                      : "Hold to record voice comment"
                }
              >
                <Mic className="w-4 h-4" />
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="absolute inset-0 w-9 h-9 rounded-full flex items-center justify-center bg-black hover:bg-gray-800 text-white shadow-md transition-all duration-200"
              aria-label="Send comment"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {(isRecording || recordedBlob) && (
        <div className="flex items-center gap-2 px-1 mt-2">
          {isRecording && (
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording
              </span>
              <span className="text-gray-400">•</span>
              <span className="font-mono text-xs text-gray-700">
                {formatSeconds(recordingSeconds)}/{formatSeconds(MAX_RECORDING_SECONDS)}
              </span>
              {isLocked && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                  Locked
                </span>
              )}
            </div>
          )}

          {recordedPreviewUrl && !isRecording && (
            <div className="flex-1 flex items-center gap-2 min-w-0 rounded-xl bg-gray-50 border border-gray-200 px-2 py-1.5">
              <CommentAudioPlayer src={recordedPreviewUrl} />
              <button
                type="button"
                onClick={discardVoice}
                className="w-8 h-8 flex-shrink-0 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors"
                aria-label="Discard recording"
                title="Discard"
              >
                <X className="w-4 h-4 text-gray-500 hover:text-red-500" />
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="w-8 h-8 flex-shrink-0 rounded-full bg-black hover:bg-gray-800 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                aria-label="Post voice comment"
                title="Post comment"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {!isRecording && !recordedBlob && !hasText && (
        <p className="text-[11px] text-gray-400 mt-2 px-1">
          Hold the mic to record, then review before posting
        </p>
      )}
    </div>
  );
}
