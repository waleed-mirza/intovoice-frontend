"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import VoicePostCard from "@/components/voice/VoicePostCard";
import Api from "@/lib/axios";
import { Radio, Loader2, UserPlus } from "@/components/voice/VoiceIcons";

interface VoicePost {
  id: string;
  title: string;
  thumbnailURL: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  station: { id: string; name: string; handle: string; avatarURL?: string };
}

export default function SubscriptionsPage() {
  const [posts, setPosts] = useState<VoicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await Api.get("/voice/feed/subscriptions");
      setPosts(res.data.result || []);
      setHasMore(res.data.pagination?.hasMore || false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load content";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await Api.get(`/voice/feed/subscriptions?page=${nextPage}`);
      setPosts((prev) => [...prev, ...(res.data.result || [])]);
      setHasMore(res.data.pagination?.hasMore || false);
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        loadMore();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Radio className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={loadInitialData}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="py-6 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <UserPlus className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No friends yet</h2>
          <p className="text-gray-500 mb-4 max-w-md">
            Add stations as friends to see their latest Audios here. Explore and find creators you
            love!
          </p>
          <Link
            href="/explore"
            className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            Explore Stations
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5 md:gap-y-10">
            {posts.map((post) => (
              <VoicePostCard key={post.id} post={post} />
            ))}
          </div>
          {loadingMore && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <div className="text-center py-8 text-gray-500">You&apos;ve reached the end</div>
          )}
        </>
      )}
    </div>
  );
}
