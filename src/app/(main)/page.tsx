"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PostSlider from "@/components/voice/PostSlider";
import CategoryChips from "@/components/voice/CategoryChips";
import VoicePostCard from "@/components/voice/VoicePostCard";
import TapeCard from "@/components/tapes/TapeCard";
import Api from "@/lib/axios";
import { ensureVoiceCategories } from "@/utils/voiceHelpers";
import { useAuth } from "@/providers/AuthProvider";
import { Radio, Loader2, Search, X } from "@/components/voice/VoiceIcons";

interface VoicePost {
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
}

interface Station {
  id: string;
  name: string;
  handle: string;
  description?: string;
  avatarURL?: string;
  subscriberCount: number;
  _count?: { posts: number; subscriptions: number };
}

import type { Tape } from "@/types/tapes";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface SearchResults {
  posts: VoicePost[];
  stations: Station[];
  tapes: Tape[];
  pagination: {
    totalPosts: number;
    totalStations: number;
    totalTapes: number;
    hasMorePosts: boolean;
    hasMoreStations: boolean;
    hasMoreTapes: boolean;
  };
}

const POSTS_PER_ROW = 3;
const ROWS_BEFORE_SECTION = 2;

function VoiceHomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const { user } = useAuth();

  const [allFeed, setAllFeed] = useState<VoicePost[]>([]);
  const [featured, setFeatured] = useState<VoicePost[]>([]);
  const [recommended, setRecommended] = useState<VoicePost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasStation, setHasStation] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchType, setSearchType] = useState<"all" | "posts" | "stations" | "tapes">("all");

  useEffect(() => {
    if (user) {
      Api.get("/voice/station/my-stations")
        .then((res) => setHasStation((res.data.result || []).length > 0))
        .catch(() => setHasStation(false));
    } else {
      setHasStation(false);
    }
  }, [user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [feedRes, categoryRes] = await Promise.all([
        Api.get("/voice/feed"),
        Api.get("/voice/category"),
      ]);
      setAllFeed(feedRes.data.all || []);
      setFeatured(feedRes.data.featured || []);
      setRecommended(feedRes.data.recommended || []);
      setHasMore(feedRes.data.pagination?.hasMore || false);
      setCategories(ensureVoiceCategories(categoryRes.data.result || []));
      setPage(1);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load content";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    try {
      setSearchLoading(true);
      setError(null);
      const res = await Api.get("/voice/feed/search", {
        params: { q: query, type: searchType },
      });
      setSearchResults(res.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Search failed";
      setError(message);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    } else {
      setSearchResults(null);
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchType]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || searchQuery) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await Api.get(`/voice/feed?page=${nextPage}`);
      setAllFeed((prev) => [...prev, ...(res.data.all || [])]);
      setHasMore(res.data.pagination?.hasMore || false);
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, searchQuery]);

  useEffect(() => {
    if (searchQuery) return;
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
  }, [loadMore, searchQuery]);

  const clearSearch = () => router.push("/");

  const FeedGrid = ({ posts, title }: { posts: VoicePost[]; title?: string }) => {
    if (posts.length === 0) return null;
    return (
      <section className="mb-8 px-4">
        {title && <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5 md:gap-y-10">
          {posts.map((post) => (
            <VoicePostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    );
  };

  const StationCard = ({ station }: { station: Station }) => (
    <Link
      href={`/station/${station.id}`}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {station.avatarURL ? (
          <img src={station.avatarURL} alt={station.name} className="w-full h-full object-cover" />
        ) : (
          <Radio className="w-8 h-8 text-gray-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{station.name}</h3>
        <p className="text-sm text-gray-500">@{station.handle}</p>
        <p className="text-xs text-gray-400 mt-1">
          {station.subscriberCount || station._count?.subscriptions || 0} subscribers
          {station._count?.posts ? ` • ${station._count.posts} Audios` : ""}
        </p>
      </div>
    </Link>
  );

  if (loading && !searchQuery) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !searchResults) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Radio className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={searchQuery ? () => performSearch(searchQuery) : loadInitialData}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (searchQuery) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">
              Results for &quot;{searchQuery}&quot;
            </h1>
          </div>
          <button
            onClick={clearSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {(["all", "posts", "stations", "tapes"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                searchType === type
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {type === "posts"
                ? "Audios"
                : type === "tapes"
                  ? "Tapes"
                  : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {searchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : searchResults ? (
          <div className="space-y-8">
            {(searchType === "all" || searchType === "stations") &&
              searchResults.stations.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Stations ({searchResults.pagination.totalStations})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.stations.map((station) => (
                      <StationCard key={station.id} station={station} />
                    ))}
                  </div>
                </section>
              )}

            {(searchType === "all" || searchType === "posts") &&
              searchResults.posts.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Audios ({searchResults.pagination.totalPosts})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5 md:gap-y-10">
                    {searchResults.posts.map((post) => (
                      <VoicePostCard key={post.id} post={post} />
                    ))}
                  </div>
                </section>
              )}

            {(searchType === "all" || searchType === "tapes") &&
              (searchResults.tapes?.length ?? 0) > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Tapes ({searchResults.pagination.totalTapes})
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {searchResults.tapes.map((tape) => (
                      <TapeCard key={tape.id} tape={tape} compact />
                    ))}
                  </div>
                </section>
              )}

            {searchResults.posts.length === 0 &&
              searchResults.stations.length === 0 &&
              (searchResults.tapes?.length ?? 0) === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No results found</h2>
                <p className="text-gray-500">Try different keywords or check your spelling</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const hasContent =
    allFeed.length > 0 || featured.length > 0 || recommended.length > 0;
  const postsPerChunk = POSTS_PER_ROW * ROWS_BEFORE_SECTION;
  const firstChunk = allFeed.slice(0, postsPerChunk);
  const secondChunk = allFeed.slice(postsPerChunk, postsPerChunk * 2);
  const remainingFeed = allFeed.slice(postsPerChunk * 2);

  return (
    <>
      <CategoryChips categories={categories} />
      {!hasContent ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <Radio className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No content yet</h2>
          <p className="text-gray-500 mb-4">
            {user && !hasStation
              ? "Create a station to start sharing your voice!"
              : "Be the first to create a station and share your voice!"}
          </p>
          {user ? (
            hasStation ? (
              <Link
                href="/upload"
                className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
              >
                Upload Content
              </Link>
            ) : (
              <Link
                href="/create-station"
                className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
              >
                Create Station
              </Link>
            )
          ) : (
            <button
              onClick={() => router.push("/auth/login?redirect=/")}
              className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              Sign In to Get Started
            </button>
          )}
        </div>
      ) : (
        <div className="py-6">
          {featured.length > 0 && <PostSlider title="Featured" posts={featured} />}
          <FeedGrid posts={firstChunk} />
          {recommended.length > 0 && <PostSlider title="Recommended" posts={recommended} />}
          {secondChunk.length > 0 && <FeedGrid posts={secondChunk} />}
          {remainingFeed.length > 0 && <FeedGrid posts={remainingFeed} />}
          {loadingMore && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}
          {!hasMore && allFeed.length > 0 && (
            <div className="text-center py-8 text-gray-500">You&apos;ve reached the end</div>
          )}
        </div>
      )}
    </>
  );
}

export default function VoiceHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <VoiceHomeContent />
    </Suspense>
  );
}
