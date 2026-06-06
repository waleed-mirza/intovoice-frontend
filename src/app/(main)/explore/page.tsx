"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import VoicePostCard from "@/components/voice/VoicePostCard";
import CategoryChips from "@/components/voice/CategoryChips";
import Api from "@/lib/axios";
import { ensureVoiceCategories, getCategoryDisplayName } from "@/utils/voiceHelpers";
import { Compass, Loader2, Radio, TrendingUp, Users } from "@/components/voice/VoiceIcons";

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

export default function ExplorePage() {
  const [trendingPosts, setTrendingPosts] = useState<VoicePost[]>([]);
  const [popularStations, setPopularStations] = useState<Station[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [feedRes, categoryRes] = await Promise.all([
        Api.get("/voice/feed"),
        Api.get("/voice/category"),
      ]);
      setTrendingPosts(feedRes.data.featured || []);
      setCategories(ensureVoiceCategories(categoryRes.data.result || []));
      if (categoryRes.data.result?.length > 0) {
        try {
          const stationsRes = await Api.get(
            `/voice/category/${categoryRes.data.result[0].slug}`
          );
          setPopularStations((stationsRes.data.result?.stations || []).slice(0, 6));
        } catch {
          /* non-fatal */
        }
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load content";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <Compass className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={loadData}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <CategoryChips categories={categories} />
      <div className="py-6 px-4">
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">Trending Now</h2>
          </div>
          {trendingPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5 md:gap-y-10">
              {trendingPosts.slice(0, 6).map((post) => (
                <VoicePostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No trending content yet</div>
          )}
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">Popular Stations</h2>
          </div>
          {popularStations.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {popularStations.map((station) => (
                <Link
                  key={station.id}
                  href={`/station/${station.id}`}
                  className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
                >
                  {station.avatarURL ? (
                    <Image
                      src={station.avatarURL}
                      alt={station.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover mb-3"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-white text-xl font-bold mb-3">
                      {station.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h3 className="font-medium text-gray-900 text-center truncate w-full text-sm">
                    {station.name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate w-full text-center">
                    @{station.handle}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No stations to show yet</div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">Browse by Category</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="p-6 bg-gray-900 rounded-xl text-white hover:bg-gray-700 transition-all"
              >
                <h3 className="font-bold text-base sm:text-lg leading-tight">
                  {getCategoryDisplayName(category.name, category.slug)}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
