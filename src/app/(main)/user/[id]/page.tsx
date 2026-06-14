"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import moment from "moment";
import Api from "@/lib/axios";
import TapeCard from "@/components/tapes/TapeCard";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { getCategoryDisplayName } from "@/utils/voiceHelpers";
import { useAuth } from "@/providers/AuthProvider";
import {
  Loader2,
  User,
  Grid,
  Radio,
  Settings,
} from "@/components/voice/VoiceIcons";
import type { Tape } from "@/types/tapes";
import { TAPE_FEED_PAGE_SIZE } from "@/utils/tapeFeedConstants";
import { setTapeFeedSeed } from "@/utils/tapeFeedCache";

interface UserStation {
  id: string;
  name: string;
  handle: string;
  description?: string;
  avatarURL?: string;
  bannerURL?: string;
  subscriberCount: number;
  category?: { id: string; name: string; slug: string };
  _count: { posts: number; subscriptions: number; tapes: number };
}

interface PublicUserProfile {
  id: string;
  name: string;
  username?: string;
  profileImg?: string;
  bannerImg?: string;
  createdAt: string;
  stations: UserStation[];
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { user: authUser } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [tapes, setTapes] = useState<Tape[]>([]);
  const [loading, setLoading] = useState(true);
  const [tapesLoading, setTapesLoading] = useState(false);
  const [tapesLoaded, setTapesLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<"stations" | "tapes">("stations");
  const [notFound, setNotFound] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const res = await Api.get(`/voice/user/${userId}`);
      setProfile(res.data.result);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNotFound(true);
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadTapes = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setTapesLoading(true);

        const res = await Api.get(`/voice/tape/user/${userId}`, {
          params: { page: pageNum, limit: TAPE_FEED_PAGE_SIZE },
        });
        const batch: Tape[] = res.data.result || [];
        const pagination = res.data.pagination;

        setTapes((prev) => (append ? [...prev, ...batch] : batch));
        setHasMore(pagination?.hasMore ?? false);
        setPage(pageNum);
        setTapesLoaded(true);
      } catch (err) {
        console.error("Failed to load user tapes:", err);
      } finally {
        setTapesLoading(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId, loadProfile]);

  useEffect(() => {
    if (activeTab === "tapes" && !tapesLoaded && userId) {
      loadTapes(1, false);
    }
  }, [activeTab, tapesLoaded, userId, loadTapes]);

  const userFeedSource = { type: "user" as const, userId };

  const cacheTapeFeedSeed = useCallback(() => {
    if (tapes.length === 0) return;
    setTapeFeedSeed(userFeedSource, { tapes, page, hasMore });
  }, [tapes, page, hasMore, userId]);

  useEffect(() => {
    if (activeTab === "tapes" && tapesLoaded && tapes.length > 0) {
      setTapeFeedSeed(userFeedSource, { tapes, page, hasMore });
    }
  }, [activeTab, tapes, tapesLoaded, page, hasMore, userId]);

  const isOwner = !!(authUser?.id && profile?.id && authUser.id === profile.id);

  const displayName =
    profile?.name ||
    (profile?.username ? `@${profile.username}` : "Creator");

  const stationCount = profile?.stations.length ?? 0;
  const totalAudios =
    profile?.stations.reduce((sum, s) => sum + s._count.posts, 0) ?? 0;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <User className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">User not found</h2>
        <p className="text-gray-500 mb-4">
          This profile doesn&apos;t exist or has been removed.
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
      {/* Banner */}
      <div className="relative w-full aspect-[3/1] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
        {profile.bannerImg ? (
          <Image
            src={resolveVoiceAssetUrl(profile.bannerImg)}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>

      {/* Profile header */}
      <div className="px-4 lg:px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="-mt-12 sm:-mt-16 relative z-10 flex-shrink-0">
            {profile.profileImg ? (
              <Image
                src={resolveVoiceAssetUrl(profile.profileImg)}
                alt={displayName}
                width={128}
                height={128}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center">
                <User className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {displayName}
            </h1>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-gray-500 mt-1 text-sm sm:text-base">
              {profile.username && <span>@{profile.username}</span>}
              {profile.username && <span>•</span>}
              <span>
                Joined {moment(profile.createdAt).format("MMMM YYYY")}
              </span>
              <span>•</span>
              <span>
                {stationCount} station{stationCount !== 1 ? "s" : ""}
              </span>
              {totalAudios > 0 && (
                <>
                  <span>•</span>
                  <span>{totalAudios} Audio{totalAudios !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>

          {isOwner && (
            <Link
              href="/settings"
              className="flex items-center gap-2 px-5 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Settings className="w-4 h-4" />
              Edit profile
            </Link>
          )}
        </div>
      </div>

      {/* Content tabs */}
      <div className="px-4 lg:px-6 py-6 max-w-6xl mx-auto">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("stations")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "stations"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Voice Stations
            {stationCount > 0 && (
              <span className="ml-1.5 text-gray-400 font-normal">{stationCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tapes")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "tapes"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Personal Tapes
          </button>
        </div>

        {activeTab === "stations" ? (
          profile.stations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Radio className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No stations yet</h3>
              <p className="text-gray-500">
                {isOwner
                  ? "Create your first station to start sharing audio."
                  : "This creator hasn't launched any stations yet."}
              </p>
              {isOwner && (
                <Link
                  href="/create-station"
                  className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
                >
                  Create Station
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {profile.stations.map((station, index) => (
                <Link
                  key={station.id}
                  href={`/station/${station.id}`}
                  className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-300"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="relative w-full aspect-[3/1] bg-gray-900">
                    {station.bannerURL ? (
                      <Image
                        src={resolveVoiceAssetUrl(station.bannerURL)}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                    )}
                  </div>
                  <div className="p-4 flex items-start gap-3 -mt-7 relative">
                    {station.avatarURL ? (
                      <div className="w-14 h-14 rounded-full overflow-hidden border-[3px] border-white bg-white flex-shrink-0 shadow-sm">
                        <Image
                          src={resolveVoiceAssetUrl(station.avatarURL)}
                          alt={station.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-white text-lg font-bold border-[3px] border-white flex-shrink-0 shadow-sm">
                        {station.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 pt-6 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate group-hover:text-gray-600 transition-colors">
                        {station.name}
                      </h3>
                      <p className="text-sm text-gray-500">@{station.handle}</p>
                      {station.description && (
                        <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">
                          {station.description}
                        </p>
                      )}
                      <div className="flex items-center flex-wrap gap-3 mt-2.5 text-xs text-gray-400">
                        <span>{station._count.posts} Audios</span>
                        <span>{station.subscriberCount} friends</span>
                        {station._count.tapes > 0 && (
                          <span>{station._count.tapes} tapes</span>
                        )}
                        {station.category && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {getCategoryDisplayName(
                              station.category.name,
                              station.category.slug
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : tapesLoading && !tapesLoaded ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : tapes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Grid className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tapes yet</h3>
            <p className="text-gray-500">
              {isOwner
                ? "Publish a personal tape that isn't tied to a station."
                : "This creator hasn't published personal tapes."}
            </p>
            {isOwner && (
              <Link
                href="/tapes/upload"
                className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
              >
                Upload Tape
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tapes.map((tape) => (
                <TapeCard
                  key={tape.id}
                  tape={tape}
                  compact
                  feedSource={userFeedSource}
                  onBeforeNavigate={cacheTapeFeedSeed}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={() => loadTapes(page + 1, true)}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
