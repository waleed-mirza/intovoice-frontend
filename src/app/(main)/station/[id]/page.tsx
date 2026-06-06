"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import VoicePostCard from "@/components/voice/VoicePostCard";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import {
  Loader2,
  Radio,
  Grid,
  Settings,
  Bell,
  BellOff,
} from "@/components/voice/VoiceIcons";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { getCategoryDisplayName } from "@/utils/voiceHelpers";
import Link from "next/link";

interface Station {
  id: string;
  name: string;
  handle: string;
  description?: string;
  avatarURL?: string;
  bannerURL?: string;
  subscriberCount: number;
  category?: { id: string; name: string; slug: string };
  user: { id: string; name: string; profileImg?: string; username?: string };
  posts: VoicePost[];
  _count: { posts: number; subscriptions: number };
  isSubscribed: boolean;
}

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

export default function StationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();

  const [station, setStation] = useState<Station | null>(null);
  const [posts, setPosts] = useState<VoicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const loadStation = async () => {
    try {
      setLoading(true);
      const res = await Api.get(`/voice/station/${id}`);
      setStation(res.data.result);
      setPosts(res.data.result.posts || []);
    } catch (err) {
      console.error("Failed to load station:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadStation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadMorePosts = async () => {
    if (!hasMore || !id) return;
    try {
      const nextPage = page + 1;
      const res = await Api.get(`/voice/post/station/${id}?page=${nextPage}`);
      setPosts((prev) => [...prev, ...(res.data.result || [])]);
      setHasMore(res.data.pagination?.hasMore || false);
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more posts:", err);
    }
  };

  const handleSubscribe = async () => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/station/" + id);
      return;
    }
    try {
      setSubscribing(true);
      const res = await Api.post(`/voice/station/${id}/subscribe`);
      setStation((prev) =>
        prev
          ? {
              ...prev,
              isSubscribed: res.data.result.isSubscribed,
              subscriberCount:
                prev.subscriberCount + (res.data.result.isSubscribed ? 1 : -1),
            }
          : null
      );
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setSubscribing(false);
    }
  };

  const isOwner = !!(user?.id && station?.user?.id && user.id === station.user.id);

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this audio? This cannot be undone.")) return;
    try {
      await Api.delete(`/voice/post/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setStation((prev) =>
        prev
          ? { ...prev, _count: { ...prev._count, posts: prev._count.posts - 1 } }
          : null
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete audio.";
      alert(message);
    }
  };

  const handleEditPost = (postId: string) => {
    router.push(`/post/${postId}/edit`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Radio className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Station not found</h2>
        <p className="text-gray-500 mb-4">
          The station you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-32 sm:h-48 lg:h-56 bg-gray-900">
        {station.bannerURL && (
          <Image
            src={resolveVoiceAssetUrl(station.bannerURL)}
            alt={station.name}
            fill
            sizes="100vw"
            className="object-cover"
          />
        )}
      </div>

      <div className="px-4 lg:px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="-mt-12 sm:-mt-16 relative z-10">
            {station.avatarURL ? (
              <Image
                src={resolveVoiceAssetUrl(station.avatarURL)}
                alt={station.name}
                width={128}
                height={128}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-800 border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-white text-3xl sm:text-4xl font-bold">
                  {station.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{station.name}</h1>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-gray-500 mt-1 text-sm sm:text-base">
              <span>@{station.handle}</span>
              <span>•</span>
              <span>{station.subscriberCount.toLocaleString()} friends</span>
              <span>•</span>
              <span>{station._count.posts} Audios</span>
            </div>
            {station.description && (
              <p className="text-gray-600 mt-2 line-clamp-2">{station.description}</p>
            )}
            {station.category && (
              <Link
                href={`/category/${station.category.slug}`}
                className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
              >
                {getCategoryDisplayName(station.category.name, station.category.slug)}
              </Link>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {isOwner ? (
              <>
                <Link
                  href={`/upload?station=${station.id}`}
                  className="flex-1 sm:flex-none px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors text-center"
                >
                  Upload
                </Link>
                <Link
                  href={`/station/${station.id}/edit`}
                  className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              </>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-full transition-colors ${
                  station.isSubscribed
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {subscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : station.isSubscribed ? (
                  <>
                    <BellOff className="w-4 h-4" />
                    Friends
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Friend
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 py-6">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Grid className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Audios yet</h3>
            <p className="text-gray-500">
              {isOwner
                ? "Upload your first audio to get started!"
                : "This station hasn't published any content yet."}
            </p>
            {isOwner && (
              <Link
                href={`/upload?station=${station.id}`}
                className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
              >
                Upload Audio
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {posts.map((post) => (
                <VoicePostCard
                  key={post.id}
                  post={post}
                  isOwner={isOwner}
                  onDelete={handleDeletePost}
                  onEdit={isOwner ? handleEditPost : undefined}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMorePosts}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
