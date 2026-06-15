"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/voice/ImageUploader";
import UploadProgressBar from "@/components/voice/UploadProgressBar";
import Api from "@/lib/axios";
import { releaseUploadedAssets } from "@/lib/uploadFileToS3";
import { resolveDeferredImageKey } from "@/lib/uploadDeferredImage";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2, Check, X } from "@/components/voice/VoiceIcons";
import Image from "next/image";

interface Category {
  id: string;
  name: string;
  slug: string;
}

const nameToHandle = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 30);

const checkHandleAvailability = async (handle: string): Promise<boolean> => {
  const res = await Api.get(`/voice/station/check-handle/${handle}`);
  return res.data.available;
};

const findAvailableHandle = async (
  baseHandle: string
): Promise<{ handle: string; available: boolean }> => {
  if (baseHandle.length < 3) {
    return { handle: baseHandle, available: false };
  }

  if (await checkHandleAvailability(baseHandle)) {
    return { handle: baseHandle, available: true };
  }

  for (let i = 1; i <= 99; i++) {
    const suffix = String(i);
    const candidate = `${baseHandle.substring(0, 30 - suffix.length)}${suffix}`;
    if (await checkHandleAvailability(candidate)) {
      return { handle: candidate, available: true };
    }
  }

  return { handle: baseHandle, available: false };
};

export default function CreateStationPage() {
  const router = useRouter();
  const { user, userLoading } = useAuth();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleManuallyEdited, setHandleManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [avatarPendingFile, setAvatarPendingFile] = useState<File | null>(null);
  const [bannerPendingFile, setBannerPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
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
    if (handleManuallyEdited) return;

    if (!name) {
      setHandle("");
      setHandleAvailable(null);
      return;
    }

    const baseHandle = nameToHandle(name);
    setHandle(baseHandle);

    if (baseHandle.length < 3) {
      setHandleAvailable(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setCheckingHandle(true);
        const result = await findAvailableHandle(baseHandle);
        if (!cancelled && nameToHandle(name) === baseHandle) {
          setHandle(result.handle);
          setHandleAvailable(result.available);
        }
      } catch {
        if (!cancelled) setHandleAvailable(null);
      } finally {
        if (!cancelled) setCheckingHandle(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, handleManuallyEdited]);

  useEffect(() => {
    if (!handleManuallyEdited) return;

    if (!handle) {
      setHandleAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (handle.length < 3) {
        setHandleAvailable(null);
        return;
      }
      try {
        setCheckingHandle(true);
        setHandleAvailable(await checkHandleAvailability(handle));
      } catch {
        setHandleAvailable(null);
      } finally {
        setCheckingHandle(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handle, handleManuallyEdited]);

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
    const uploadedKeys: string[] = [];
    try {
      setCreating(true);
      setError(null);

      let finalAvatarURL = avatarURL || undefined;
      let finalBannerURL = bannerURL || undefined;

      if (avatarPendingFile) {
        setUploadLabel("Uploading avatar...");
        const avatarResult = await resolveDeferredImageKey(
          { pendingFile: avatarPendingFile, committedKey: "", removed: false },
          "avatar",
          (percent) => setUploadProgress(avatarPendingFile && bannerPendingFile ? percent / 2 : percent)
        );
        uploadedKeys.push(...avatarResult.uploadedKeys);
        finalAvatarURL = avatarResult.key || undefined;
      }

      if (bannerPendingFile) {
        setUploadLabel("Uploading banner...");
        const bannerResult = await resolveDeferredImageKey(
          { pendingFile: bannerPendingFile, committedKey: "", removed: false },
          "banner",
          (percent) =>
            setUploadProgress(
              avatarPendingFile ? 50 + percent / 2 : percent
            )
        );
        uploadedKeys.push(...bannerResult.uploadedKeys);
        finalBannerURL = bannerResult.key || undefined;
      }

      setUploadProgress(null);
      setUploadLabel("");

      const res = await Api.post("/voice/station", {
        name,
        handle,
        description,
        categoryId: categoryId || undefined,
        avatarURL: finalAvatarURL,
        bannerURL: finalBannerURL,
      });
      router.push(`/station/${res.data.result.id}`);
    } catch (err: unknown) {
      await releaseUploadedAssets(uploadedKeys);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create station";
      setError(message);
    } finally {
      setCreating(false);
      setUploadProgress(null);
      setUploadLabel("");
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
              onChange={(e) => {
                setHandleManuallyEdited(true);
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
              }}
              placeholder="mystation"
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
          {!handleManuallyEdited &&
            handleAvailable === true &&
            handle &&
            handle !== nameToHandle(name) && (
              <p className="text-sm text-green-600 mt-1">
                @{handle} is available
              </p>
            )}
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
              onValueChange={setAvatarURL}
              pendingFile={avatarPendingFile}
              onPendingFileChange={setAvatarPendingFile}
              type="avatar"
              className="w-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner</label>
            <ImageUploader
              value={bannerURL}
              onValueChange={setBannerURL}
              pendingFile={bannerPendingFile}
              onPendingFileChange={setBannerPendingFile}
              type="banner"
            />
          </div>
        </div>

        {uploadProgress !== null && (
          <UploadProgressBar label={uploadLabel || "Uploading images..."} percent={uploadProgress} />
        )}

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
