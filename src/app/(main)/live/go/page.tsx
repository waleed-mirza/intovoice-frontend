"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2, ChevronLeft } from "@/components/voice/VoiceIcons";
import LiveSetupForm from "@/components/live/LiveSetupForm";
import Toast from "@/utils/CustomToast";

interface StationOption {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string | null;
}

export default function GoLivePage() {
  const router = useRouter();
  const { user, userLoading } = useAuth();
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/live/go");
      return;
    }

    Api.get("/voice/station/my-stations")
      .then((res) => setStations(res.data.result || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, userLoading, router]);

  const handleSubmit = async (data: {
    title: string;
    description: string;
    stationId: string | null;
  }) => {
    try {
      setSubmitting(true);
      const res = await Api.post("/voice/live/start", data);
      const stream = res.data.result;
      router.push(`/live/${stream.id}?role=host`);
    } catch (err: unknown) {
      console.error(err);
      Toast("error", "Failed to start broadcast. Please try again.");
      setSubmitting(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to live
      </Link>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Go live</h1>
        <p className="text-sm text-gray-600 mb-6">
          Set up your audio broadcast before going on air.
        </p>

        <LiveSetupForm
          stations={stations}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </div>
    </div>
  );
}
