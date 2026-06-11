"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2 } from "@/components/voice/VoiceIcons";
import type { LiveStream } from "@/types/live";
import LiveHero from "@/components/live/LiveHero";
import LiveStreamCard from "@/components/live/LiveStreamCard";
import LiveEmptyState from "@/components/live/LiveEmptyState";

export default function LivePage() {
  const router = useRouter();
  const { user, userLoading } = useAuth();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myActive, setMyActive] = useState<LiveStream | null>(null);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [activeRes, myRes] = await Promise.all([
        Api.get("/voice/live/active"),
        Api.get("/voice/live/my-active"),
      ]);

      setStreams(activeRes.data.result || []);
      setMyActive(myRes.data.result || null);
    } catch (err) {
      console.error("Failed to load live streams:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/live");
      return;
    }
    loadData();
  }, [user, userLoading, router, loadData]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-12 space-y-6">
      <LiveHero
        count={streams.length}
        refreshing={refreshing}
        hasActiveStream={Boolean(myActive)}
        activeStreamId={myActive?.id}
      />

      {streams.length === 0 ? (
        <LiveEmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((stream, index) => (
            <LiveStreamCard
              key={stream.id}
              stream={stream}
              featured={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
