"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Waveform from "@/components/voice/Waveform";
import VoicePostCard from "@/components/voice/VoicePostCard";
import Api from "@/lib/axios";
import voice from "@/utils/voiceTheme";
import { formatDuration } from "@/utils/voiceHelpers";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { useAuth } from "@/providers/AuthProvider";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import useVoiceCommentSubmit from "@/components/voice/hooks/useVoiceCommentSubmit";
import ReportModal from "@/components/reports/ReportModal";
import VoiceCommentCard from "@/components/comments/VoiceCommentCard";
import {
  removeCommentFromTree,
  updateCommentInTree,
} from "@/components/comments/commentTreeUtils";
import type { VoiceComment } from "@/components/comments/voiceCommentTypes";
import {
  Loader2,
  ThumbsUp,
  MessageSquare,
  Share2,
  Bell,
  BellOff,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Mic,
  X,
} from "@/components/voice/VoiceIcons";
import { FiFlag as ReportFlagIcon } from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoicePost {
  id: string;
  title: string;
  description?: string;
  thumbnailURL: string;
  audioURL: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  station: {
    id: string;
    name: string;
    handle: string;
    avatarURL?: string;
    user: {
      id: string;
      name: string;
      profileImg?: string;
    };
    _count: {
      subscriptions: number;
    };
  };
  isSubscribed: boolean;
  _count: {
    comments: number;
  };
}

type Comment = VoiceComment;

// ─── Compact Audio Player for voice comments ──────────────────────────────────

const CommentAudioPlayer = ({ src }: { src: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // True while we're doing the WebM Infinity-duration seek trick
  const seekingForDurationRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state on src change
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    seekingForDurationRef.current = false;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (d && isFinite(d)) {
        setDuration(d);
      } else {
        // WebM/MediaRecorder blobs report Infinity — seek to a huge value
        // so the browser is forced to decode the full file and report real duration
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
          audio.currentTime = 0; // reset to start after the trick
          setCurrentTime(0);
        }
      }
    };

    const onTimeUpdate = () => {
      // Ignore position updates that are part of the duration-seek trick
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
      } catch (err) {
        console.error("CommentAudioPlayer: playback failed:", err);
        setPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  // Only compute pct when we actually have a real duration
  const safeDuration = duration > 0 ? duration : 0;
  const safeCurrentTime = Math.min(currentTime, safeDuration);
  const pct = safeDuration > 0 ? (safeCurrentTime / safeDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mt-2 min-w-0">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
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
          style={{
            background: voice.progressGradient(pct),
          }}
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>{formatDuration(safeCurrentTime)}</span>
          <span>{safeDuration > 0 ? formatDuration(safeDuration) : "--:--"}</span>
        </div>
      </div>
      {/* Animated waveform dots when playing */}
      <div className={`flex items-end gap-0.5 h-5 flex-shrink-0 ${playing ? "" : "opacity-30"}`}>
        {[2, 4, 3, 5, 2].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gray-700"
            style={{
              height: `${h * 3}px`,
              animation: playing ? `voiceCommentPulse 0.8s ease-in-out ${i * 0.15}s infinite alternate` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RECORDING_SECONDS = 59;
const HOLD_TO_RECORD_MS = 180;
const LOCK_THRESHOLD_PX = 50;

// ─── Main Page ────────────────────────────────────────────────────────────────

const PostPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekingForDurationRef = useRef(false);
  const isSeekingRef = useRef(false);

  const [post, setPost] = useState<VoicePost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<VoicePost[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDescription, setShowDescription] = useState(false);
  const [liking, setLiking] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    threadRootId: string;
    targetAuthorName: string;
  } | null>(null);
  const [loadingRepliesFor, setLoadingRepliesFor] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeCommentTextarea = () => {
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  // ── Local player state (single post source of truth) ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // ── Post-level report modal ──
  const [postReportOpen, setPostReportOpen] = useState(false);
  const canReportPost = Boolean(
    user?.id && post?.station?.user?.id && user.id !== post.station.user.id
  );

  // ── Voice recorder ──
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

  const { isSending, submitComment } = useVoiceCommentSubmit<Comment>({
    postId: id,
    parentId: replyingTo?.threadRootId ?? null,
    maxRecordingSeconds: MAX_RECORDING_SECONDS,
  });

  // ── Load post ──
  useEffect(() => {
    if (id) loadPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const [postRes, relatedRes, commentsRes] = await Promise.all([
        Api.get(`/voice/post/${id}`),
        Api.get(`/voice/post/${id}/related`),
        Api.get(`/voice/comment/post/${id}`),
      ]);
      const loadedPost: VoicePost = postRes.data.result;
      setPost(loadedPost);
      setRelatedPosts(relatedRes.data.result || []);
      setComments(commentsRes.data.result || []);
    } catch (err) {
      console.error("Failed to load post:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Audio element wiring ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !post) return;

    const applyDuration = (raw: number) => {
      if (Number.isFinite(raw) && raw > 0) {
        setDuration(raw);
        return true;
      }
      return false;
    };

    const onLoadedMetadata = () => {
      if (applyDuration(audio.duration)) return;
      if (post.duration > 0) {
        setDuration(post.duration);
        return;
      }
      seekingForDurationRef.current = true;
      audio.currentTime = 1e9;
    };

    const onDurationChange = () => {
      if (applyDuration(audio.duration)) {
        if (seekingForDurationRef.current) {
          seekingForDurationRef.current = false;
          audio.currentTime = 0;
          setCurrentTime(0);
        }
        return;
      }
      if (post.duration > 0) setDuration(post.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      const total = post.duration > 0 ? post.duration : audio.duration;
      if (Number.isFinite(total) && total > 0) {
        setCurrentTime(total);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      if (!seekingForDurationRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };
    const onVolumeChange = () => setIsMuted(audio.muted);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("volumechange", onVolumeChange);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("volumechange", onVolumeChange);
    };
  }, [post?.id, post?.duration, post?.audioURL]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;

    const tick = () => {
      const audio = audioRef.current;
      if (audio && !seekingForDurationRef.current && !isSeekingRef.current) {
        setCurrentTime(audio.currentTime);
      }
      if (audio && !audio.paused && !audio.ended) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !post) return;
    const src = resolveVoiceAssetUrl(post.audioURL);
    seekingForDurationRef.current = false;
    setCurrentTime(0);
    setDuration(post.duration || 0);
    if (audio.src !== src) {
      audio.src = src;
    }
    audio.load();
    audio.muted = false;
    setIsMuted(false);
    audio.play().catch((err) => {
      console.error("PostPage: autoplay failed:", err);
      setIsPlaying(false);
    });
  }, [post?.id, post?.audioURL, post?.duration]);

  // ── Player controls — local audio element ──
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (err) {
        console.error("PostPage: play failed:", err);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleSeekStart = () => {
    isSeekingRef.current = true;
  };

  const handleSeekEnd = () => {
    isSeekingRef.current = false;
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const total =
      Number.isFinite(duration) && duration > 0 ? duration : post?.duration ?? 0;
    audio.currentTime = Math.max(0, Math.min(total, currentTime + seconds));
  };

  const playerDuration =
    Number.isFinite(duration) && duration > 0 ? duration : post?.duration ?? 0;
  const playerCurrentTime =
    playerDuration > 0 ? Math.min(currentTime, playerDuration) : currentTime;
  const playerProgress =
    playerDuration > 0 ? (playerCurrentTime / playerDuration) * 100 : 0;

  // ── Post actions ──
  const handleLike = async () => {
    if (userLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    try {
      setLiking(true);
      const res = await Api.post(`/voice/post/${id}/like`);
      setPost((prev) =>
        prev ? { ...prev, isLiked: res.data.result.isLiked, likeCount: res.data.result.likeCount } : null
      );
    } catch (err) {
      console.error("Failed to like:", err);
    } finally {
      setLiking(false);
    }
  };

  const handleSubscribe = async () => {
    if (userLoading) return;
    if (!user || !post) { router.push("/auth/login"); return; }
    try {
      setSubscribing(true);
      const res = await Api.post(`/voice/station/${post.station.id}/subscribe`);
      setPost((prev) => prev ? { ...prev, isSubscribed: res.data.result.isSubscribed } : null);
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setSubscribing(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post?.title || "Into Voice", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.error("Failed to share:", err);
    }
  };

  // ── Comment actions ──
  const handleSendComment = async () => {
    if (userLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    if (isSending) return;

    const activeReply = replyingTo;
    const result = await submitComment({
      text: newComment,
      recordedBlob,
      isRecording,
      stopRecording,
      recordingSeconds,
      onTooLong: triggerMaxReachedTooltip,
    });

    if (result) {
      if (activeReply) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === activeReply.threadRootId
              ? {
                  ...c,
                  replies: [...(c.replies || []), { ...result, replies: [] }],
                  replyCount: (c.replyCount ?? c.replies?.length ?? 0) + 1,
                }
              : c
          )
        );
      } else {
        setComments((prev) => [{ ...result, replies: result.replies ?? [] }, ...prev]);
      }
      setPost((prev) =>
        prev ? { ...prev, _count: { comments: prev._count.comments + 1 } } : null
      );
      setReplyingTo(null);
      setNewComment("");
      if (commentTextareaRef.current) {
        commentTextareaRef.current.style.height = "auto";
      }
      resetAudioState();
    }
  };

  const handleStartReply = useCallback(
    (threadRootId: string, targetAuthorName: string) => {
      if (userLoading) return;
      if (!user) { router.push("/auth/login"); return; }
      setReplyingTo({ threadRootId, targetAuthorName });
      commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [user, userLoading, router]
  );

  const handleLoadMoreReplies = async (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment || loadingRepliesFor.has(commentId)) return;

    setLoadingRepliesFor((prev) => new Set(prev).add(commentId));
    try {
      const limit = Math.min(comment.replyCount ?? 50, 50);
      const res = await Api.get(`/voice/comment/${commentId}/replies`, {
        params: { page: 1, limit },
      });
      const allReplies: Comment[] = res.data.result || [];
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, replies: allReplies } : c))
      );
    } catch (err) {
      console.error("Failed to load replies:", err);
    } finally {
      setLoadingRepliesFor((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (userLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    try {
      const res = await Api.post(`/voice/comment/${commentId}/like`);
      setComments((prev) =>
        updateCommentInTree(prev, commentId, {
          isLiked: res.data.result.isLiked,
          likeCount: res.data.result.likeCount,
        })
      );
    } catch (err) {
      console.error("Failed to like comment:", err);
    }
  };

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await Api.delete(`/voice/comment/${commentId}`);
      setComments((prev) => removeCommentFromTree(prev, commentId));
      setPost((prev) =>
        prev ? { ...prev, _count: { comments: Math.max(0, prev._count.comments - 1) } } : null
      );
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }, []);

  const handleUpdateComment = useCallback((commentId: string, content: string) => {
    setComments((prev) => updateCommentInTree(prev, commentId, { content }));
  }, []);

  // ── Mute toggle ──
  const handleToggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  // ── Mic gesture handlers ──
  const micHandlers = micBind();
  const hasText = newComment.trim().length > 0;
  const canSendAudio = !!recordedBlob || (isRecording && isLocked && !isPressingMic);
  const canSend = hasText || canSendAudio;
  const sendDisabled = isSending || suppressSendSwap || isPressingMic || !canSend;

  // ── Render states ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Post not found</h2>
        <Link href="/" className="text-gray-700 hover:underline">Go back home</Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
         <audio ref={audioRef} preload="metadata" className="hidden" />
        {/* ── Main Content ── */}
        <div className="flex-1 max-w-4xl">
          {/* Thumbnail / Player */}
          <div
            className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden group cursor-pointer"
            onClick={togglePlay}
          >
            <Image
              src={resolveVoiceAssetUrl(post.thumbnailURL)}
              alt={post.title}
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              className={`object-cover transition-opacity duration-700 ${isPlaying ? "opacity-40" : "opacity-100"}`}
            />

            <div
              className={`absolute inset-0 z-10 transition-opacity duration-700 pointer-events-none ${
                isPlaying ? "opacity-100" : "opacity-0"
              }`}
            >
              <Waveform isPlaying={isPlaying} color={voice.fill} />
            </div>

            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 sm:p-4 pointer-events-none">
              <div
                className="relative w-full h-1 mb-2 sm:mb-4 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute inset-0 bg-gray-600 rounded-lg" />
                <div
                  className="absolute inset-y-0 left-0 rounded-lg pointer-events-none will-change-[width]"
                  style={{
                    width: `${playerProgress}%`,
                    background: voice.fill,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={playerDuration || 1}
                  step={0.01}
                  value={playerCurrentTime}
                  onChange={handleSeek}
                  onMouseDown={handleSeekStart}
                  onMouseUp={handleSeekEnd}
                  onTouchStart={handleSeekStart}
                  onTouchEnd={handleSeekEnd}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                />
              </div>
              <div className="flex items-center justify-between gap-1 sm:gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 sm:gap-4">
                  <button onClick={() => skip(-10)} className="text-white hover:text-gray-300 p-0.5 sm:p-1">
                    <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors flex-shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    ) : (
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white ml-0.5" />
                    )}
                  </button>
                  <button onClick={() => skip(10)} className="text-white hover:text-gray-300 p-0.5 sm:p-1">
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <span className="text-white text-[10px] sm:text-sm tabular-nums whitespace-nowrap">
                    {formatDuration(playerCurrentTime)} / {formatDuration(playerDuration)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleToggleMute}
                    className="text-white hover:text-gray-300 hidden sm:block"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={isMuted ? 0 : 1}
                    onChange={(e) => {
                      if (parseFloat(e.target.value) === 0) {
                        if (!isMuted) handleToggleMute();
                      } else {
                        if (isMuted) handleToggleMute();
                      }
                    }}
                    className="w-16 sm:w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer hidden sm:block"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 1 – Title + meta */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 leading-snug">{post.title}</h1>
            <div className="flex items-center gap-2 text-gray-400 text-xs whitespace-nowrap sm:mt-1 sm:flex-shrink-0">
              <span>{post.viewCount.toLocaleString()} listens</span>
              <span>•</span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Row 2 – Station + actions */}
          <div className="flex items-center gap-2 sm:gap-3 mt-2 pb-3 border-b border-gray-200">
            {/* Station */}
            <Link href={`/station/${post.station.id}`} className="flex items-center gap-2 min-w-0 flex-1">
              {post.station.avatarURL ? (
                <img
                  src={resolveVoiceAssetUrl(post.station.avatarURL)}
                  alt={post.station.name}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-sm">
                  {post.station.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 hover:text-gray-600 truncate">{post.station.name}</p>
                <p className="text-xs text-gray-400">{post.station._count.subscriptions.toLocaleString()} friends</p>
              </div>
            </Link>

            {/* Friend */}
            {user?.id !== post.station.user.id && (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                  post.isSubscribed
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {subscribing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : post.isSubscribed ? (
                  <><BellOff className="w-3.5 h-3.5" /><span className="hidden sm:inline">Friends</span></>
                ) : (
                  <><Bell className="w-3.5 h-3.5" /><span className="hidden sm:inline">Friend</span></>
                )}
              </button>
            )}

            {/* Like */}
            <button
              onClick={handleLike}
              disabled={liking}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 bg-gray-100 text-gray-700 ${
                !post.isLiked ? "hover:bg-gray-200" : ""
              }`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${post.isLiked ? "fill-current" : ""}`} />
              <span>{post.likeCount}</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Report */}
            {canReportPost && (
              <button
                type="button"
                onClick={() => setPostReportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                title="Report voice post"
                aria-label="Report voice post"
              >
                <ReportFlagIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Report</span>
              </button>
            )}
          </div>

          {/* Description */}
          {post.description && (
            <div className="py-4 border-b border-gray-200">
              <div className={`text-gray-700 whitespace-pre-wrap ${showDescription ? "" : "line-clamp-2"}`}>
                {post.description}
              </div>
              {post.description.length > 150 && (
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className="flex items-center gap-1 text-gray-700 text-sm mt-2"
                >
                  {showDescription ? (
                    <>Show less <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>Show more <ChevronDown className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── Comments Section ── */}
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-700" />
              <h3 className="font-semibold text-gray-900">
                {post._count.comments} {post._count.comments === 1 ? "Comment" : "Comments"}
              </h3>
            </div>

            {/* Comment Input */}
            {user ? (
              <div
                ref={commentInputRef}
                className={`bg-gray-50 rounded-2xl p-3 mb-6 border transition-colors ${
                  replyingTo ? "border-gray-400 ring-1 ring-gray-300" : "border-gray-200"
                }`}
              >
                {replyingTo && (
                  <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <p className="text-xs text-gray-600">
                      Replying to{" "}
                      <span className="font-semibold text-gray-900">
                        {replyingTo.targetAuthorName}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {/* WhatsApp-style input bar */}
                <div className="flex items-end gap-2">
                  {/* User avatar */}
                  <div className="flex-shrink-0 mb-0.5">
                    {user.profileImg ? (
                      <img
                        src={user.profileImg}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold text-xs">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Text input */}
                  <div className="flex-1 relative">
                    <textarea
                      ref={commentTextareaRef}
                      rows={1}
                      value={newComment}
                      onChange={(e) => {
                        setNewComment(e.target.value);
                        resizeCommentTextarea();
                      }}
                      disabled={!!recordedBlob}
                      placeholder={
                        isRecording
                          ? "Recording…"
                          : recordedBlob
                          ? "Audio recorded — clear to type"
                          : replyingTo
                          ? `Reply to ${replyingTo.targetAuthorName}…`
                          : "Add a comment…"
                      }
                      className={`w-full px-4 py-2.5 rounded-2xl text-sm border transition-all resize-none overflow-y-auto min-h-[40px] max-h-40 leading-normal focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                        recordedBlob
                          ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>

                  {/* Mic + Send buttons */}
                  <div className="relative flex items-center gap-2 flex-shrink-0">
                    {/* Max reached tooltip */}
                    {showMaxReachedTooltip && (
                      <div className="absolute -top-10 right-0 text-[11px] text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm z-10 whitespace-nowrap">
                        Max {MAX_RECORDING_SECONDS}s reached
                      </div>
                    )}

                    {/* Slide-to-lock indicator — sits above the buttons, centred, never clips off-screen */}
                    {isRecording && !isLocked && (
                      <div className="absolute bottom-full mb-2 right-0 flex items-center gap-1.5 pointer-events-none z-10">
                        <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
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

                    {/* Mic / locked stop button */}
                    {isRecording && isLocked ? (
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
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 bg-red-500 text-white shadow-lg scale-110 ${
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
                        onTouchStart={(e) => { micHandlers.onPointerDown?.(e as unknown as React.PointerEvent); }}
                        onTouchMove={(e) => { micHandlers.onPointerMove?.(e as unknown as React.PointerEvent); }}
                        onTouchEnd={(e) => {
                          micHandlers.onPointerUp?.(e as unknown as React.PointerEvent);
                          if (isRecording && !isLocked) stopRecording();
                        }}
                        onPointerMove={(e) => { micHandlers.onPointerMove?.(e); }}
                        onPointerUp={(e) => {
                          micHandlers.onPointerUp?.(e);
                          if (isRecording && !isLocked) stopRecording();
                        }}
                        onPointerCancel={(e) => {
                          micHandlers.onPointerUp?.(e);
                          if (isRecording && !isLocked) stopRecording();
                        }}
                        disabled={isSending || hasText}
                        style={{ touchAction: "none" }}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isRecording
                            ? "bg-red-500 text-white shadow-lg scale-110"
                            : hasText
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-black hover:bg-gray-800 text-white shadow-md active:scale-95"
                        } ${isSending ? "opacity-60 cursor-not-allowed" : ""}`}
                        aria-label={
                          hasText
                            ? "Clear text to record"
                            : "Hold to record voice comment"
                        }
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}

                    {/* Send button */}
                    <button
                      type="button"
                      onClick={handleSendComment}
                      disabled={sendDisabled}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        sendDisabled
                          ? "opacity-0 scale-0 absolute"
                          : "bg-black hover:bg-gray-800 text-white shadow-md scale-100"
                      }`}
                      aria-label="Send comment"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Recording status & preview */}
                {(isRecording || recordedBlob) && (
                  <div className="flex items-center gap-2 px-1 mt-2">
                    {isRecording && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
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
                            🔒 Locked
                          </span>
                        )}
                      </div>
                    )}

                    {recordedPreviewUrl && !isRecording && (
                      <div className="flex-1 flex items-center gap-2">
                        <CommentAudioPlayer src={recordedPreviewUrl} />
                        <button
                          type="button"
                          onClick={discardVoice}
                          className="w-7 h-7 flex-shrink-0 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors"
                          aria-label="Discard recording"
                        >
                          <X className="w-4 h-4 text-gray-500 hover:text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Helper hint */}
                {!isRecording && !recordedBlob && !hasText && (
                  <p className="text-[11px] text-gray-400 mt-2 px-1">
                    Hold <span className="text-gray-500 font-medium">🎙</span> to record a voice comment
                  </p>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="block text-center py-3 mb-6 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
              >
                Sign in to leave a comment
              </Link>
            )}

            {/* Comments List */}
            <div className="space-y-5">
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-50 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="space-y-3">
                    <VoiceCommentCard
                      comment={comment}
                      currentUserId={user?.id}
                      ownerUserId={post.station.user.id}
                      onLike={handleCommentLike}
                      onDelete={handleDeleteComment}
                      onUpdate={handleUpdateComment}
                      onReply={
                        user
                          ? () => handleStartReply(comment.id, comment.author.name)
                          : undefined
                      }
                    />
                    {(comment.replies ?? []).map((reply) => (
                      <VoiceCommentCard
                        key={reply.id}
                        comment={reply}
                        isReply
                        currentUserId={user?.id}
                        ownerUserId={post.station.user.id}
                        onLike={handleCommentLike}
                        onDelete={handleDeleteComment}
                        onUpdate={handleUpdateComment}
                        onReply={
                          user
                            ? () => handleStartReply(comment.id, reply.author.name)
                            : undefined
                        }
                      />
                    ))}
                    {(comment.replyCount ?? 0) > (comment.replies?.length ?? 0) && (
                      <button
                        type="button"
                        onClick={() => handleLoadMoreReplies(comment.id)}
                        disabled={loadingRepliesFor.has(comment.id)}
                        className="ml-8 sm:ml-10 pl-3 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                      >
                        {loadingRepliesFor.has(comment.id) ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading replies…
                          </span>
                        ) : (
                          `View ${(comment.replyCount ?? 0) - (comment.replies?.length ?? 0)} more ${
                            (comment.replyCount ?? 0) - (comment.replies?.length ?? 0) === 1
                              ? "reply"
                              : "replies"
                          }`
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Related Posts Sidebar ── */}
        <div className="lg:w-80 xl:w-96">
          <h3 className="font-medium text-gray-900 mb-4">Related</h3>
          <div className="space-y-4">
            {relatedPosts.map((relPost) => (
              <VoicePostCard key={relPost.id} post={relPost} size="small" />
            ))}
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={postReportOpen}
        onClose={() => setPostReportOpen(false)}
        targetType="voice_post"
        targetId={post.id}
        targetPreview={
          (post.title || post.description || "").trim().slice(0, 140) ||
          "🎙️ Voice post"
        }
      />
    </>
  );
};

export default PostPage;
