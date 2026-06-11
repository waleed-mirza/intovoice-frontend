"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2 } from "@/components/voice/VoiceIcons";
import type { LiveStream } from "@/types/live";
import useZegoLive from "@/hooks/useZegoLive";
import LiveStage from "@/components/live/LiveStage";
import LiveChatPanel from "@/components/live/LiveChatPanel";
import LiveHostControls from "@/components/live/LiveHostControls";
import LiveListenerBar from "@/components/live/LiveListenerBar";
import LiveEndedOverlay from "@/components/live/LiveEndedOverlay";

function LiveRoomContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [ending, setEnding] = useState(false);

  const roleParam = searchParams.get("role");
  const role = useMemo<"host" | "audience">(() => {
    if (roleParam === "host" && stream && user?.id === stream.user.id) {
      return "host";
    }
    return "audience";
  }, [roleParam, stream, user?.id]);

  const loadStream = useCallback(async () => {
    try {
      setLoading(true);
      const res = await Api.get(`/voice/live/${id}`);
      setStream(res.data.result);
      setEnded(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const data = (err as { response?: { data?: { result?: LiveStream } } })
        ?.response?.data;
      if (status === 410) {
        setStream(data?.result || null);
        setEnded(true);
      } else {
        console.error(err);
        router.push("/live");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push(`/auth/login?redirect=/live/${id}`);
      return;
    }
    loadStream();
  }, [user, userLoading, router, id, loadStream]);

  const zegoEnabled = Boolean(stream && user && !ended && !loading);

  const {
    connectionState,
    isMuted,
    isPlaying,
    listenerCount,
    messages,
    sendChat,
    toggleMute,
    toggleVolume,
    cleanup,
  } = useZegoLive({
    liveStreamId: id,
    roomId: stream?.roomId || "",
    streamId: stream?.streamId || "",
    role,
    userId: user?.id || "",
    userName: user?.name || user?.username || "User",
    hostUserId: stream?.user.id || "",
    enabled: zegoEnabled,
  });

  useEffect(() => {
    if (connectionState === "ended") {
      setEnded(true);
    }
  }, [connectionState]);

  const handleEnd = async () => {
    try {
      setEnding(true);
      await Api.post(`/voice/live/${id}/end`);
      await cleanup();
      setEnded(true);
      router.push("/live");
    } catch (err) {
      console.error(err);
    } finally {
      setEnding(false);
    }
  };

  const handleLeave = () => {
    cleanup();
  };

  if (userLoading || loading || !stream) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const showEnded = ended || connectionState === "ended";

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-12">
      <div className="relative bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {showEnded && <LiveEndedOverlay />}

        <div className="lg:grid lg:grid-cols-5">
          <div className="lg:col-span-3">
            <LiveStage
              stream={stream}
              connectionState={showEnded ? "ended" : connectionState}
              role={role}
              isPlaying={isPlaying}
            />

            {role === "host" && !showEnded && (
              <LiveHostControls
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onEnd={handleEnd}
                ending={ending}
              />
            )}

            {role === "audience" && !showEnded && (
              <LiveListenerBar
                onToggleVolume={toggleVolume}
                onLeave={handleLeave}
              />
            )}
          </div>

          <div className="lg:col-span-2 border-t lg:border-t-0 lg:border-l border-gray-100">
            <LiveChatPanel
              messages={messages}
              onSend={sendChat}
              listenerCount={listenerCount}
              hostUserId={stream.user.id}
              disabled={showEnded || connectionState !== "connected"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <LiveRoomContent />
    </Suspense>
  );
}
