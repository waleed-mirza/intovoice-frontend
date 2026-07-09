"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Api from "@/lib/axios";
import { endLiveStreamKeepalive } from "@/lib/endLiveStream";
import { MAX_LIVE_DURATION_SECONDS } from "@/lib/liveLimits";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2 } from "@/components/voice/VoiceIcons";
import type { LiveStream } from "@/types/live";
import useZegoLive from "@/hooks/useZegoLive";
import LiveStage from "@/components/live/LiveStage";
import LiveChatPanel from "@/components/live/LiveChatPanel";
import LiveHostControls from "@/components/live/LiveHostControls";
import LiveListenerBar from "@/components/live/LiveListenerBar";
import LiveListenersPanel from "@/components/live/LiveListenersPanel";
import LiveEndedOverlay from "@/components/live/LiveEndedOverlay";

export default function LiveRoomClient() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const endedRef = useRef(false);
  const hostFinalizingRef = useRef(false);

  const markEnded = useCallback(() => {
    endedRef.current = true;
    setEnded(true);
  }, []);

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
      endedRef.current = false;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const data = (err as { response?: { data?: { result?: LiveStream } } })
        ?.response?.data;
      if (status === 410) {
        setStream(data?.result || null);
        markEnded();
      } else {
        console.error(err);
        router.push("/live");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router, markEnded]);

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
    isVolumeMuted,
    isPlaying,
    listenerCount,
    listeners,
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

  const endOnServer = useCallback(async () => {
    try {
      await Api.post(`/voice/live/${id}/end`);
    } catch {
      // Host may have already ended, or the request failed during unload.
    }
  }, [id]);

  // Host: end the broadcast when leaving the page or closing the tab.
  useEffect(() => {
    if (role !== "host" || endedRef.current) return;

    const handlePageHide = () => {
      endLiveStreamKeepalive(id);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      if (!endedRef.current) {
        void endOnServer();
      }
    };
  }, [role, id, endOnServer]);

  // Host: end when Zego disconnects unexpectedly (network loss, tab killed, etc.).
  useEffect(() => {
    if (
      role !== "host" ||
      endedRef.current ||
      hostFinalizingRef.current ||
      connectionState !== "ended"
    ) {
      return;
    }

    hostFinalizingRef.current = true;

    const finalize = async () => {
      await endOnServer();
      await cleanup();
      markEnded();
      router.push("/live");
    };

    void finalize();
  }, [role, connectionState, endOnServer, cleanup, markEnded, router]);

  // Host: heartbeat so the server knows this broadcast is still active.
  useEffect(() => {
    if (role !== "host" || endedRef.current || connectionState !== "connected") {
      return;
    }

    const sendHeartbeat = () => {
      Api.post(`/voice/live/${id}/heartbeat`)
        .then(() => undefined)
        .catch((err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response
            ?.status;
          if (status === 410) {
            markEnded();
          }
        });
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [role, id, connectionState, markEnded]);

  // Auto-end when the 59-minute hard cap is reached.
  useEffect(() => {
    if (!stream?.startedAt || ended) return;

    const finalizeAtCap = () => {
      if (endedRef.current) return;
      if (role === "host") {
        if (hostFinalizingRef.current) return;
        hostFinalizingRef.current = true;
        void (async () => {
          await endOnServer();
          await cleanup();
          markEnded();
          router.push("/live");
        })();
        return;
      }
      markEnded();
    };

    const remainingMs =
      MAX_LIVE_DURATION_SECONDS * 1000 -
      (Date.now() - new Date(stream.startedAt).getTime());

    if (remainingMs <= 0) {
      finalizeAtCap();
      return;
    }

    const timer = setTimeout(finalizeAtCap, remainingMs);
    return () => clearTimeout(timer);
  }, [
    stream?.startedAt,
    role,
    ended,
    endOnServer,
    cleanup,
    markEnded,
    router,
  ]);

  // Audience: poll in case the host ended the broadcast on the server first.
  useEffect(() => {
    if (role !== "audience" || endedRef.current || connectionState !== "connected") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await Api.get(`/voice/live/${id}`);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 410) {
          markEnded();
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [role, id, connectionState, markEnded]);

  useEffect(() => {
    if (connectionState === "ended" && role === "audience") {
      markEnded();
    }
  }, [connectionState, role, markEnded]);

  // Audience: disconnect and leave the room when the broadcast ends.
  useEffect(() => {
    if (role !== "audience" || !endedRef.current) return;

    let cancelled = false;

    const leaveRoom = async () => {
      await cleanup();
      if (!cancelled) {
        router.push("/live");
      }
    };

    const timer = setTimeout(() => {
      void leaveRoom();
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [role, ended, connectionState, cleanup, router]);

  const handleEnd = async () => {
    try {
      setEnding(true);
      markEnded();
      await Api.post(`/voice/live/${id}/end`);
      await cleanup();
      router.push("/live");
    } catch (err) {
      console.error(err);
      endedRef.current = false;
      setEnded(false);
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

        <div className="lg:grid lg:grid-cols-5 lg:items-stretch lg:min-h-0">
          <div className="lg:col-span-3 flex flex-col min-h-0">
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
                isVolumeMuted={isVolumeMuted}
                onToggleVolume={toggleVolume}
                onLeave={handleLeave}
              />
            )}
          </div>

          <div className="lg:col-span-2 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0 overflow-hidden h-[min(420px,52dvh)] max-h-[min(420px,52dvh)] lg:h-0 lg:max-h-none lg:min-h-full">
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

      {role === "host" && !showEnded && (
        <LiveListenersPanel liveStreamId={id} listeners={listeners} />
      )}
    </div>
  );
}
