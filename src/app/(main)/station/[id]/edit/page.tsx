"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ImageUploader from "@/components/voice/ImageUploader";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2, Check, X, Settings, AlertCircle, BarChart3 } from "@/components/voice/VoiceIcons";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Station {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  categoryId: string | null;
  avatarURL: string | null;
  bannerURL: string | null;
  userId: string;
}

export default function EditStationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [originalHandle, setOriginalHandle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(true);
  const [checkingHandle, setCheckingHandle] = useState(false);

  const loadStation = async () => {
    try {
      setLoading(true);
      const res = await Api.get(`/voice/station/${id}`);
      const station: Station = res.data.result;
      if (user && station.userId !== user.id) {
        router.push(`/station/${id}`);
        return;
      }
      setName(station.name);
      setHandle(station.handle);
      setOriginalHandle(station.handle);
      setDescription(station.description || "");
      setCategoryId(station.categoryId || "");
      setAvatarURL(station.avatarURL || "");
      setBannerURL(station.bannerURL || "");
      setError(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load station details";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoading) return;
    if (!user && !loading) {
      router.push(`/auth/login?redirect=/station/${id}/edit`);
      return;
    }
    Api.get("/voice/category")
      .then((res) => setCategories(res.data.result || []))
      .catch(console.error);
    if (id) loadStation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, userLoading]);

  useEffect(() => {
    if (!handle) {
      setHandleAvailable(null);
      return;
    }
    if (handle === originalHandle) {
      setHandleAvailable(true);
      return;
    }
    const timer = setTimeout(async () => {
      if (!handle || handle.length < 3) {
        setHandleAvailable(null);
        return;
      }
      try {
        setCheckingHandle(true);
        const res = await Api.get(`/voice/station/check-handle/${handle}`);
        setHandleAvailable(res.data.available);
      } catch {
        setHandleAvailable(null);
      } finally {
        setCheckingHandle(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [handle, originalHandle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !handle) {
      setError("Name and handle are required");
      return;
    }
    if (handleAvailable === false) {
      setError("This handle is already taken");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await Api.put(`/voice/station/${id}`, {
        name,
        handle,
        description: description || undefined,
        categoryId: categoryId || undefined,
        avatarURL: avatarURL || undefined,
        bannerURL: bannerURL || undefined,
      });
      router.push(`/station/${id}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update station";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
        <p className="text-gray-500 animate-pulse">Loading station details...</p>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-700">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Station Settings</h1>
            <p className="text-gray-500">Update your station details and appearance</p>
          </div>
        </div>
        <Link
          href={`/station/${id}/analytics`}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">Analytics</span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Station Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            required
          />
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Handle *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
            <input
              type="text"
              value={handle}
              onChange={(e) =>
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
              }
              maxLength={30}
              className={`w-full pl-8 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                handleAvailable === true
                  ? "border-green-300 focus:ring-green-500"
                  : handleAvailable === false
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-200 focus:ring-gray-400"
              }`}
              required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {checkingHandle && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
              {!checkingHandle && handleAvailable === true && (
                <Check className="w-5 h-5 text-green-500" />
              )}
              {!checkingHandle && handleAvailable === false && (
                <X className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
          {handleAvailable === false && (
            <p className="text-sm text-red-500 mt-1">This handle is already taken</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
          />
          <p className="text-xs text-gray-500 mt-2 text-right">{description.length}/500</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Branding</h3>
          <ImageUploader value={avatarURL} onChange={setAvatarURL} type="avatar" className="w-32" />
          <ImageUploader value={bannerURL} onChange={setBannerURL} type="banner" />
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || handleAvailable === false || !name || !handle}
            className="flex-[2] py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving Changes...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
