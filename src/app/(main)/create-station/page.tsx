"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/voice/ImageUploader";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2, Check, X } from "@/components/voice/VoiceIcons";
import Image from "next/image";

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function CreateStationPage() {
  const router = useRouter();
  const { user, userLoading } = useAuth();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/create-station");
      return;
    }
    Api.get("/voice/category")
      .then((res) => setCategories(res.data.result || []))
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  useEffect(() => {
    if (name && !handle) {
      setHandle(
        name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    if (!handle) {
      setHandleAvailable(null);
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
  }, [handle]);

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
      setCreating(true);
      setError(null);
      const res = await Api.post("/voice/station", {
        name,
        handle,
        description,
        categoryId: categoryId || undefined,
        avatarURL: avatarURL || undefined,
        bannerURL: bannerURL || undefined,
      });
      router.push(`/station/${res.data.result.id}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create station";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  if (!user && !userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Image
            src="/intovoice_logo.png"
            alt="Into Voice"
            width={64}
            height={64}
            className="object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Create Your Voice Station</h1>
        <p className="text-gray-500 mt-2">
          A station is your place where you can share audio content
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Station Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Station"
            maxLength={50}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Handle *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
            <input
              type="text"
              value={handle}
              onChange={(e) =>
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
              }
              placeholder="my-station"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell listeners what your station is about..."
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
          />
          <p className="text-sm text-gray-500 mt-1 text-right">{description.length}/500</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Branding</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Avatar</label>
            <ImageUploader
              value={avatarURL}
              onChange={setAvatarURL}
              type="avatar"
              className="w-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner</label>
            <ImageUploader value={bannerURL} onChange={setBannerURL} type="banner" />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={creating || handleAvailable === false || !name || !handle}
          className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Station"
          )}
        </button>
      </form>
    </div>
  );
}
