"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Api from "@/lib/axios";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import { useAuth } from "@/providers/AuthProvider";
import { getCategoryDisplayName } from "@/utils/voiceHelpers";
import {
  Radio,
  Loader2,
  Plus,
  MoreVertical,
  BarChart3,
  Trash2,
  Edit,
} from "@/components/voice/VoiceIcons";

interface Station {
  id: string;
  name: string;
  handle: string;
  description?: string;
  avatarURL?: string;
  bannerURL?: string;
  subscriberCount: number;
  category?: { id: string; name: string; slug: string };
  _count?: { posts: number; subscriptions: number };
}

export default function MyStationsPage() {
  const router = useRouter();
  const { user, userLoading } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  const loadStations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await Api.get("/voice/station/my-stations");
      setStations(res.data.result || []);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load stations";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/my-stations");
      return;
    }
    loadStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  const handleDeleteStation = async (stationId: string) => {
    try {
      setDeleting(stationId);
      await Api.delete(`/voice/station/${stationId}`);
      setStations(stations.filter((s) => s.id !== stationId));
      setDeleteConfirm(null);
      setDropdownOpen(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete station";
      alert(message);
    } finally {
      setDeleting(null);
    }
  };

  if (userLoading || loading) {
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
          onClick={loadStations}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="py-6 px-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Voice Stations</h1>
          <Link
            href="/create-station"
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Station</span>
          </Link>
        </div>

        {stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <Radio className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No stations yet</h2>
            <p className="text-gray-500 mb-4 max-w-md">
              Create your first station to start sharing audio content with the world!
            </p>
            <Link
              href="/create-station"
              className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              Create Your First Station
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {stations.map((station) => (
              <div
                key={station.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative w-full aspect-[3/1] bg-gray-900">
                  {station.bannerURL && (
                    <Image
                      src={resolveVoiceAssetUrl(station.bannerURL)}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 1024px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-4 flex items-start gap-4 -mt-8 relative">
                  <Link href={`/station/${station.id}`}>
                    {station.avatarURL ? (
                      <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white bg-white flex-shrink-0">
                        <Image
                          src={resolveVoiceAssetUrl(station.avatarURL)}
                          alt={station.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-white text-xl font-bold border-4 border-white">
                        {station.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 pt-8">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/station/${station.id}`}
                          className="text-lg font-bold text-gray-900 hover:text-gray-600"
                        >
                          {station.name}
                        </Link>
                        <p className="text-sm text-gray-500">@{station.handle}</p>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setDropdownOpen(dropdownOpen === station.id ? null : station.id)
                          }
                          className="p-2 hover:bg-gray-100 rounded-full"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                        {dropdownOpen === station.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setDropdownOpen(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <Link
                                href={`/station/${station.id}/edit`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setDropdownOpen(null)}
                              >
                                <Edit className="w-4 h-4" />
                                Edit Station
                              </Link>
                              <button
                                onClick={() => {
                                  setDeleteConfirm(station.id);
                                  setDropdownOpen(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Station
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {station.description && (
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                        {station.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span>{station._count?.posts || 0} Audios</span>
                      <span>
                        {station.subscriberCount || station._count?.subscriptions || 0} friends
                      </span>
                      {station.category && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                          {getCategoryDisplayName(
                            station.category.name,
                            station.category.slug
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-2 mt-4">
                      <Link
                        href={`/upload?station=${station.id}`}
                        className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
                      >
                        Upload
                      </Link>
                      <Link
                        href={`/station/${station.id}/analytics`}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                      </Link>
                      <Link
                        href={`/station/${station.id}`}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Station?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete the station and all its Audios, comments, and media.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting === deleteConfirm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteStation(deleteConfirm)}
                disabled={deleting === deleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting === deleteConfirm ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
