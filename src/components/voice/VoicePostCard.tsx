"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiFlag } from "react-icons/fi";
import {
  Loader2,
  MoreVertical,
  Play,
  Trash2,
  Pencil,
} from "@/components/voice/VoiceIcons";
import { formatDuration, formatTimeAgo, formatListens } from "@/utils/voiceHelpers";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import ReportModal from "@/components/reports/ReportModal";
import { useAuth } from "@/providers/AuthProvider";

interface VoicePostCardProps {
  post: {
    id: string;
    title: string;
    thumbnailURL: string;
    duration: number;
    viewCount: number;
    likeCount: number;
    createdAt: string;
    station: {
      id: string;
      name: string;
      handle: string;
      avatarURL?: string;
    };
  };
  size?: "normal" | "small" | "large";
  isOwner?: boolean;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (postId: string) => void;
}

// size prop reserved for layout variants (small/large) used by PostSlider
const VoicePostCard = ({ post, isOwner = false, onDelete, onEdit }: VoicePostCardProps) => {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canReport = Boolean(user?.id) && !isOwner;
  const showMenu = isOwner || canReport;

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
    if (!onDelete) return;
    setDeleting(true);
    setMenuOpen(false);
    try {
      await onDelete(post.id);
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="group cursor-pointer relative">
      {/* Context menu (owner: Edit/Delete; others: Report) */}
      {showMenu && (
        <div ref={menuRef} className="absolute top-2 right-2 z-20">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            title="Audio options"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <MoreVertical className="w-4 h-4 text-white" />
            )}
          </button>
          {menuOpen && (
            <div className="absolute top-9 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
              {isOwner && onEdit && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onEdit(post.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              )}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              {canReport && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
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

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="voice_post"
        targetId={post.id}
        targetPreview={post.title}
      />

      {/* Thumbnail - 16:9 aspect ratio like YouTube */}
      <Link href={`/post/${post.id}`}>
        <div className="relative w-full rounded-xl overflow-hidden bg-gray-200 aspect-[4/2]">
          {!imgError && post.thumbnailURL ? (
            <Image
              src={resolveVoiceAssetUrl(post.thumbnailURL)}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gray-200 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                <Play className="w-8 h-8 text-gray-700 ml-1" />
              </div>
            </div>
          )}
          
          {/* Play button overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-7 h-7 text-white ml-1" fill="white" />
            </div>
          </div>
          
          {/* Duration badge - YouTube style */}
          <div className="absolute bottom-2 right-2 bg-black/90 text-white text-xs font-medium px-1.5 py-0.5 rounded">
            {formatDuration(post.duration)}
          </div>
        </div>
      </Link>

      {/* Info - YouTube style layout */}
      <div className="flex gap-3 mt-3">
        {/* Station Avatar */}
        <Link href={`/station/${post.station.id}`} className="flex-shrink-0">
          {post.station.avatarURL ? (
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={resolveVoiceAssetUrl(post.station.avatarURL)}
                alt={post.station.name}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-sm">
              {post.station.name.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          {/* Title - larger like YouTube */}
          <Link href={`/post/${post.id}`}>
            <h3 className="font-medium text-gray-900 text-[15px] leading-snug line-clamp-2">
              {post.title}
            </h3>
          </Link>

          {/* Station name */}
          <Link
            href={`/station/${post.station.id}`}
            className="text-[13px] text-gray-600 hover:text-gray-900 mt-1 block"
          >
            {post.station.name}
          </Link>

          {/* Listens and time - same line like YouTube */}
          <div className="text-[13px] text-gray-600">
            {formatListens(post.viewCount)} • {formatTimeAgo(post.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoicePostCard;
