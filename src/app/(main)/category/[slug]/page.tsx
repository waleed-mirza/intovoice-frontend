"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import CategoryChips from "@/components/voice/CategoryChips";
import VoicePostCard from "@/components/voice/VoicePostCard";
import Api from "@/lib/axios";
import { ensureVoiceCategories, getCategoryDisplayName } from "@/utils/voiceHelpers";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { Radio, Loader2, Users } from "@/components/voice/VoiceIcons";

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

interface Station {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string;
  subscriberCount: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<VoicePost[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      setPage(1);
      const [categoryRes, stationsRes, categoriesRes] = await Promise.all([
        Api.get(`/voice/feed/category/${slug}`),
        Api.get(`/voice/category/${slug}/stations`),
        Api.get("/voice/category"),
      ]);
      setCategory(categoryRes.data.category || null);
      setPosts(categoryRes.data.result || []);
      setHasMore(categoryRes.data.pagination?.hasMore || false);
      setStations(stationsRes.data.result || []);
      setCategories(ensureVoiceCategories(categoriesRes.data.result || []));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setError("Category not found");
      } else {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Failed to load content";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) loadCategoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await Api.get(`/voice/feed/category/${slug}?page=${nextPage}`);
      setPosts((prev) => [...prev, ...(res.data.result || [])]);
      setHasMore(res.data.pagination?.hasMore || false);
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, slug]);

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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {error === "Category not found" ? "Category not found" : "Something went wrong"}
        </h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <Link
          href="/"
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <>
      <CategoryChips categories={categories} activeSlug={slug} />
      <div className="py-6">
        <div className="px-4 lg:px-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {getCategoryDisplayName(category?.name || "", category?.slug)}
          </h1>
          <p className="text-gray-500 mt-1">
            {posts.length} {posts.length === 1 ? "Audio" : "Audios"} in this category
          </p>
        </div>

        {stations.length > 0 && (
          <section className="px-4 lg:px-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Popular Stations</h2>
            <div
              className="flex gap-4 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none" }}
            >
              {stations.slice(0, 10).map((station) => (
                <Link
                  key={station.id}
                  href={`/station/${station.id}`}
                  className="flex-shrink-0 flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all w-32"
                >
                  {station.avatarURL ? (
                    <Image
                      src={resolveVoiceAssetUrl(station.avatarURL)}
                      alt={station.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover mb-2"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-2">
                      <span className="text-white text-xl font-bold">
                        {station.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="font-medium text-sm text-gray-900 text-center truncate w-full">
                    {station.name}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3" />
                    {station.subscriberCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {posts.length > 0 ? (
          <section className="px-4 lg:px-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Audios</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {posts.map((post) => (
                <VoicePostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Radio className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Audios yet</h3>
            <p className="text-gray-500">Be the first to create content in this category!</p>
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <div className="text-center py-8 text-gray-500">You&apos;ve reached the end</div>
        )}
      </div>
    </>
  );
}
