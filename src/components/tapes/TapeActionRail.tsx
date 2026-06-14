"use client";

import React, { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { FiFlag } from "react-icons/fi";
import {
  HiOutlineHandThumbUp,
  HiHandThumbUp,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineEllipsisVertical,
} from "react-icons/hi2";

import {
  Bell,
  BellOff,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Heart,
  MessageCircle,
} from "@/components/voice/VoiceIcons";

import { useAuth } from "@/providers/AuthProvider";

import Api from "@/lib/axios";

import ReportModal from "@/components/reports/ReportModal";

import ShareTapeButton from "./ShareTapeButton";

import type { Tape } from "@/types/tapes";

interface TapeActionRailProps {
  tape: Tape;

  onTapeUpdate: (updates: Partial<Tape>) => void;

  onOpenComments: () => void;

  onTapeDelete?: (tapeId: string) => void;

  commentsOpen?: boolean;

  variant?: "pill" | "rail";

  theme?: "default" | "overlay";

  compact?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;

  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;

  return String(n);
}

function TapeOptionsMenu({
  isOwner,
  canReport,
  theme,
  compact,
  overlayMode,
  overlayIconWrap,
  railBtn,
  railIcon,
  labelClass,
  glyphSize,
  onEdit,
  onDelete,
  onReport,
}: {
  isOwner: boolean;
  canReport: boolean;
  theme: "default" | "overlay";
  compact: boolean;
  overlayMode?: boolean;
  overlayIconWrap?: string;
  railBtn: string;
  railIcon: string;
  labelClass: string;
  glyphSize: string;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();

    e.stopPropagation();

    if (!confirm("Delete this tape? This cannot be undone.")) return;

    setDeleting(true);

    setMenuOpen(false);

    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    e.stopPropagation();

    setMenuOpen((open) => !open);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={toggleMenu}
        className={railBtn}
        aria-label="More options"
        aria-expanded={menuOpen}
      >
        {overlayMode ? (
          <span className={overlayIconWrap}>
            {deleting ? (
              <Loader2 className={`${glyphSize} animate-spin`} />
            ) : (
              <HiOutlineEllipsisVertical className={glyphSize} />
            )}
          </span>
        ) : (
          <span className={railIcon}>
            {deleting ? (
              <Loader2 className={`${glyphSize} animate-spin`} />
            ) : (
              <MoreVertical className={glyphSize} />
            )}
          </span>
        )}

        {!compact && !overlayMode && (
          <span
            className={`${labelClass} ${theme === "default" ? "font-medium" : ""}`}
          >
            More
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 bottom-full mb-2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[132px]"
          onClick={(e) => e.stopPropagation()}
        >
          {isOwner && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();

                e.stopPropagation();

                setMenuOpen(false);

                onEdit();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}

          {canReport && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();

                e.stopPropagation();

                setMenuOpen(false);

                onReport();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <FiFlag className="w-4 h-4" />
              Report
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TapeActionRail({
  tape,

  onTapeUpdate,

  onOpenComments,

  onTapeDelete,

  commentsOpen = false,

  variant = "rail",

  theme = "default",

  compact = false,
}: TapeActionRailProps) {
  const router = useRouter();

  const { user, userLoading } = useAuth();

  const [liking, setLiking] = useState(false);

  const [subscribing, setSubscribing] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);

  const [pillMenuOpen, setPillMenuOpen] = useState(false);

  const [pillDeleting, setPillDeleting] = useState(false);

  const pillMenuRef = useRef<HTMLDivElement>(null);

  const isOwner = Boolean(user && (tape.isOwner || tape.userId === user.id));

  const canReport = Boolean(user && !isOwner);

  const showMenu = isOwner || canReport;

  useEffect(() => {
    if (!pillMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pillMenuRef.current &&
        !pillMenuRef.current.contains(e.target as Node)
      ) {
        setPillMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pillMenuOpen]);

  const requireAuth = () => {
    if (userLoading) return false;

    if (!user) {
      router.push(`/auth/login?redirect=/tapes/${tape.id}`);

      return false;
    }

    return true;
  };

  const handleEdit = () => {
    if (!requireAuth()) return;

    router.push(`/tapes/${tape.id}/edit`);
  };

  const handleDeleteTape = async () => {
    if (!requireAuth()) return;

    await Api.delete(`/voice/tape/${tape.id}`);

    onTapeDelete?.(tape.id);
  };

  const handleLike = async () => {
    if (!requireAuth() || liking) return;

    setLiking(true);

    try {
      const res = await Api.post(`/voice/tape/${tape.id}/like`);

      onTapeUpdate({
        isLiked: res.data.result.isLiked,

        likeCount: res.data.result.likeCount,
      });
    } catch (err) {
      console.error("Failed to like tape:", err);
    } finally {
      setLiking(false);
    }
  };

  const handleSubscribe = async () => {
    if (!tape.stationId || !requireAuth() || subscribing) return;

    setSubscribing(true);

    try {
      const res = await Api.post(`/voice/station/${tape.stationId}/subscribe`);

      onTapeUpdate({
        isSubscribed: res.data.result?.isSubscribed ?? !tape.isSubscribed,
      });
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setSubscribing(false);
    }
  };

  if (variant === "pill") {
    const actionPill =
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50";

    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {tape.stationId && user?.id !== tape.station?.userId && (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                tape.isSubscribed
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  : "bg-black text-white hover:bg-gray-800"
              } disabled:opacity-50`}
            >
              {subscribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : tape.isSubscribed ? (
                <>
                  <BellOff className="w-3.5 h-3.5" />

                  <span className="hidden sm:inline">Friends</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />

                  <span className="hidden sm:inline">Friend</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className={`${actionPill} ${tape.isLiked ? "text-gray-900" : ""}`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${tape.isLiked ? "fill-current text-red-500" : ""}`}
            />

            <span>{tape.likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => requireAuth() && onOpenComments()}
            className={actionPill}
          >
            <MessageCircle className="w-3.5 h-3.5" />

            <span>{tape.commentCount}</span>
          </button>

          <ShareTapeButton
            tapeId={tape.id}
            caption={tape.caption}
            variant="pill"
          />

          {showMenu && (
            <div ref={pillMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setPillMenuOpen((open) => !open)}
                className={actionPill}
                aria-label="More options"
                aria-expanded={pillMenuOpen}
              >
                {pillDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="w-3.5 h-3.5" />
                )}
              </button>

              {pillMenuOpen && (
                <div className="absolute bottom-full mb-2 right-0 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[132px]">
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setPillMenuOpen(false);

                        handleEdit();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  )}

                  {isOwner && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm("Delete this tape? This cannot be undone.")
                        )
                          return;

                        setPillDeleting(true);

                        setPillMenuOpen(false);

                        try {
                          await handleDeleteTape();
                        } finally {
                          setPillDeleting(false);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}

                  {canReport && (
                    <button
                      type="button"
                      onClick={() => {
                        setPillMenuOpen(false);

                        setReportOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <FiFlag className="w-4 h-4" />
                      Report
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <ReportModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="voice_tape"
          targetId={tape.id}
        />
      </>
    );
  }

  const isOverlay = theme === "overlay";

  if (isOverlay) {
    const stackGap = "gap-4";
    const glyphSize = compact ? "w-6 h-6" : "w-7 h-7";
    const iconWrap =
      "flex items-center justify-center rounded-full bg-gray-100/95 p-2.5 shadow-md shadow-black/20 text-gray-800";
    const labelClass =
      "text-[11px] font-semibold text-white tabular-nums leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]";
    const railBtn =
      "flex flex-col items-center gap-1.5 disabled:opacity-50 transition-opacity active:opacity-80";

    return (
      <>
        <div
          className={`flex flex-col items-center ${stackGap} pb-0 flex-shrink-0`}
        >
          {tape.stationId && user?.id !== tape.station?.userId && (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribing}
              className={railBtn}
            >
              <span className={iconWrap}>
                {subscribing ? (
                  <Loader2 className={`${glyphSize} animate-spin`} />
                ) : tape.isSubscribed ? (
                  <BellOff className={glyphSize} />
                ) : (
                  <Bell className={glyphSize} />
                )}
              </span>
              {!compact && (
                <span className={labelClass}>
                  {tape.isSubscribed ? "Friends" : "Friend"}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className={railBtn}
            aria-label="Like"
          >
            <span className={iconWrap}>
              {liking ? (
                <Loader2 className={`${glyphSize} animate-spin`} />
              ) : tape.isLiked ? (
                <HiHandThumbUp className={`${glyphSize} text-red-500`} />
              ) : (
                <HiOutlineHandThumbUp className={glyphSize} />
              )}
            </span>
            <span className={labelClass}>{formatCount(tape.likeCount)}</span>
          </button>

          <button
            type="button"
            onClick={() => requireAuth() && onOpenComments()}
            className={railBtn}
            aria-label={commentsOpen ? "Close comments" : "Comments"}
            aria-pressed={commentsOpen}
          >
            <span className={iconWrap}>
              <HiOutlineChatBubbleLeftEllipsis className={glyphSize} />
            </span>
            <span className={labelClass}>
              {formatCount(tape.commentCount)}
            </span>
          </button>

          <ShareTapeButton
            tapeId={tape.id}
            caption={tape.caption}
            variant="rail"
            theme="overlay"
            compact={compact}
          />

          {showMenu && (
            <TapeOptionsMenu
              isOwner={isOwner}
              canReport={canReport}
              theme={theme}
              compact={compact}
              overlayMode
              overlayIconWrap={iconWrap}
              railBtn={railBtn}
              railIcon=""
              labelClass={labelClass}
              glyphSize={glyphSize}
              onEdit={handleEdit}
              onDelete={handleDeleteTape}
              onReport={() => setReportOpen(true)}
            />
          )}
        </div>

        <ReportModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="voice_tape"
          targetId={tape.id}
        />
      </>
    );
  }

  const iconSize = compact ? "w-9 h-9" : "w-9 h-9 sm:w-11 sm:h-11";

  const glyphSize = compact ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5";

  const stackGap = compact ? "gap-3" : "gap-3 sm:gap-5";

  const labelClass = compact
    ? "text-[9px] font-bold tabular-nums leading-tight text-gray-800"
    : "text-[10px] sm:text-[11px] font-bold tabular-nums text-gray-800";

  const railIconBase = `${iconSize} rounded-full flex items-center justify-center transition-all`;

  const railIcon = `${railIconBase} bg-white text-gray-800 hover:bg-gray-50 shadow-md`;

  const countPill =
    "bg-white shadow-sm rounded-full px-1.5 min-w-[1.25rem] text-center";

  const likedIcon = railIcon;

  const railBtn =
    "flex flex-col items-center gap-0.5 disabled:opacity-50 transition-colors";

  return (
    <>
      <div
        className={`flex flex-col items-center ${stackGap} pb-0 flex-shrink-0`}
      >
        {tape.stationId && user?.id !== tape.station?.userId && (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={subscribing}
            className={railBtn}
          >
            <span
              className={`${railIcon} ${tape.isSubscribed ? "bg-gray-200 text-gray-900" : ""}`}
            >
              {subscribing ? (
                <Loader2 className={`${glyphSize} animate-spin`} />
              ) : tape.isSubscribed ? (
                <BellOff className={glyphSize} />
              ) : (
                <Bell className={glyphSize} />
              )}
            </span>

            {!compact && (
              <span className={`${labelClass} max-w-[52px] text-center`}>
                {tape.isSubscribed ? "Friends" : "Friend"}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleLike}
          disabled={liking}
          className={railBtn}
          aria-label="Like"
        >
          <span className={tape.isLiked ? likedIcon : railIcon}>
            {liking ? (
              <Loader2 className={`${glyphSize} animate-spin`} />
            ) : (
              <Heart
                className={`${glyphSize} ${tape.isLiked ? "fill-current text-red-500" : ""}`}
              />
            )}
          </span>

          <span className={`${labelClass} ${countPill}`}>
            {formatCount(tape.likeCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => requireAuth() && onOpenComments()}
          className={railBtn}
          aria-label={commentsOpen ? "Close comments" : "Comments"}
          aria-pressed={commentsOpen}
        >
          <span className={`${railIcon} ${commentsOpen ? likedIcon : ""}`}>
            <MessageCircle className={glyphSize} />
          </span>

          <span className={`${labelClass} ${countPill}`}>
            {formatCount(tape.commentCount)}
          </span>
        </button>

        <ShareTapeButton
          tapeId={tape.id}
          caption={tape.caption}
          variant="rail"
          compact={compact}
        />

        {showMenu && (
          <TapeOptionsMenu
            isOwner={isOwner}
            canReport={canReport}
            theme={theme}
            compact={compact}
            railBtn={railBtn}
            railIcon={railIcon}
            labelClass={labelClass}
            glyphSize={glyphSize}
            onEdit={handleEdit}
            onDelete={handleDeleteTape}
            onReport={() => setReportOpen(true)}
          />
        )}
      </div>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="voice_tape"
        targetId={tape.id}
      />
    </>
  );
}
