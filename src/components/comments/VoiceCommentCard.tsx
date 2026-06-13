"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiFlag as ReportFlagIcon } from "react-icons/fi";
import {
  ThumbsUp,
  MessageSquare,
  Loader2,
  Trash2,
  MoreVertical,
  Pencil,
} from "@/components/voice/VoiceIcons";
import ReportModal from "@/components/reports/ReportModal";
import CommentText from "@/components/comments/CommentText";
import CommentAudioPlayer from "@/components/comments/CommentAudioPlayer";
import Api from "@/lib/axios";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { formatTimeAgo } from "@/utils/voiceHelpers";
import type { VoiceComment } from "@/components/comments/voiceCommentTypes";

function CommentActionButton({
  onClick,
  disabled,
  active,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none ${
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function CommentOptionsMenu({
  canEdit,
  canDelete,
  canReport,
  deleting,
  onEdit,
  onDelete,
  onReport,
}: {
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Comment options"
        aria-expanded={menuOpen}
      >
        {deleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <MoreVertical className="w-3.5 h-3.5" />
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onEdit();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
          {canReport && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onReport();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <ReportFlagIcon className="w-3.5 h-3.5" />
              Report
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface VoiceCommentCardProps {
  comment: VoiceComment;
  currentUserId?: string;
  ownerUserId?: string;
  isReply?: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, content: string) => void;
  onReply?: () => void;
}

export default function VoiceCommentCard({
  comment,
  currentUserId,
  ownerUserId,
  isReply,
  onLike,
  onDelete,
  onUpdate,
  onReply,
}: VoiceCommentCardProps) {
  const isOwn = currentUserId === comment.author.id;
  const canDelete = isOwn || (ownerUserId != null && currentUserId === ownerUserId);
  const canReport = Boolean(currentUserId) && !isOwn;
  const hasTextContent = Boolean((comment.content || "").trim());
  const canEdit = isOwn && !comment.audioFileURL && hasTextContent;
  const showMenu = canEdit || canDelete || canReport;

  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content || "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm("Delete this comment?")) return;
    setDeleting(true);
    await onDelete(comment.id);
    setDeleting(false);
  };

  const handleStartEdit = () => {
    setEditText(comment.content || "");
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(comment.content || "");
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      setEditError("Comment cannot be empty");
      return;
    }
    if (trimmed === (comment.content || "").trim()) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const res = await Api.put(`/voice/comment/${comment.id}`, { content: trimmed });
      const updatedContent = res.data.result?.content ?? trimmed;
      onUpdate?.(comment.id, updatedContent);
      setIsEditing(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update comment";
      setEditError(message);
    } finally {
      setSaving(false);
    }
  };

  const audioSrc = comment.audioFileURL
    ? resolveVoiceAssetUrl(comment.audioFileURL)
    : null;
  const displayName = comment.author.username || comment.author.name;

  return (
    <div className={`flex gap-3 ${isReply ? "ml-6 pl-3 border-l border-gray-200" : ""}`}>
      <div className="flex-shrink-0">
        {comment.author.profileImg ? (
          <img
            src={resolveVoiceAssetUrl(comment.author.profileImg)}
            alt={comment.author.name}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold text-sm">
            {comment.author.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {displayName.startsWith("@") ? displayName : `@${displayName}`}
            </span>
            {isOwn && (
              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-medium">
                You
              </span>
            )}
            <span className="text-xs text-gray-400">{formatTimeAgo(comment.createdAt)}</span>
          </div>

          {showMenu && (
            <CommentOptionsMenu
              canEdit={canEdit}
              canDelete={canDelete}
              canReport={canReport}
              deleting={deleting}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
              onReport={() => setReportOpen(true)}
            />
          )}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={1000}
              rows={3}
              autoFocus
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
            {editError && <p className="text-xs text-red-600">{editError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasTextContent && comment.content.trim() !== " " && (
              <CommentText
                text={comment.content}
                className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
              />
            )}

            {audioSrc && <CommentAudioPlayer src={audioSrc} />}
          </>
        )}

        {!isEditing && (
          <div className="flex items-center gap-0.5 mt-2 pt-0.5">
            <CommentActionButton
              onClick={() => onLike(comment.id)}
              active={comment.isLiked}
              ariaLabel={comment.isLiked ? "Unlike comment" : "Like comment"}
              title={comment.isLiked ? "Unlike" : "Like"}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${comment.isLiked ? "fill-current" : ""}`} />
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </CommentActionButton>

            {onReply && (
              <CommentActionButton
                onClick={onReply}
                ariaLabel="Reply to comment"
                title="Reply"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Reply</span>
              </CommentActionButton>
            )}
          </div>
        )}
      </div>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="voice_comment"
        targetId={comment.id}
        targetPreview={
          (comment.content || "").trim().slice(0, 140) ||
          (comment.audioFileURL ? "Voice comment" : undefined)
        }
      />
    </div>
  );
}
