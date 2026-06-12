"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Api from "@/lib/axios";
import type { LiveChatMessage, LiveConnectionState, LiveRoomListener } from "@/types/live";

type LiveRole = "host" | "audience";

interface UseZegoLiveOptions {
  liveStreamId: string;
  roomId: string;
  streamId: string;
  role: LiveRole;
  userId: string;
  userName: string;
  hostUserId: string;
  enabled: boolean;
}

interface ZegoEngine {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  loginRoom: (
    roomID: string,
    token: string,
    user: { userID: string; userName: string },
    config?: { userUpdate?: boolean }
  ) => Promise<boolean>;
  logoutRoom: (roomID?: string) => void;
  renewToken: (token: string, roomID?: string) => boolean;
  createZegoStream: (options?: {
    camera?: { audio?: boolean; video?: boolean };
  }) => Promise<{ stream?: MediaStream }>;
  startPublishingStream: (
    streamID: string,
    localStream: unknown,
    publishOption?: { roomID?: string }
  ) => boolean;
  stopPublishingStream: (streamID: string) => void;
  startPlayingStream: (
    streamID: string,
    playOption?: { roomID?: string }
  ) => Promise<MediaStream>;
  stopPlayingStream: (streamID: string) => void;
  sendBroadcastMessage: (
    roomID: string,
    message: string
  ) => Promise<{ errorCode?: number }>;
  muteMicrophone: (mute: boolean) => boolean;
  destroyEngine: () => void;
}

const parseChatPayload = (
  raw: string,
  fromUserId: string,
  fromUserName: string,
  sendTime: number,
  selfUserId: string
): LiveChatMessage | null => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "chat" && typeof parsed.text === "string") {
      return {
        id: `${fromUserId}-${sendTime}`,
        userId: parsed.userId || fromUserId,
        name: parsed.name || fromUserName,
        text: parsed.text.trim(),
        sendTime,
        isSelf: (parsed.userId || fromUserId) === selfUserId,
      };
    }
  } catch {
    if (raw.trim()) {
      return {
        id: `${fromUserId}-${sendTime}`,
        userId: fromUserId,
        name: fromUserName,
        text: raw.trim(),
        sendTime,
        isSelf: fromUserId === selfUserId,
      };
    }
  }
  return null;
};

export default function useZegoLive({
  liveStreamId,
  roomId,
  streamId,
  role,
  userId,
  userName,
  hostUserId,
  enabled,
}: UseZegoLiveOptions) {
  const engineRef = useRef<ZegoEngine | null>(null);
  const localStreamRef = useRef<{ stream?: MediaStream } | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const playingStreamIdRef = useRef<string | null>(null);
  const joinedRef = useRef(false);
  const lastSendRef = useRef(0);

  const [connectionState, setConnectionState] =
    useState<LiveConnectionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isVolumeMuted, setIsVolumeMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [listeners, setListeners] = useState<LiveRoomListener[]>([]);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    const res = await Api.get(
      `/voice/live/${liveStreamId}/token?role=${role}`
    );
    return res.data.result as {
      token: string;
      appId: number;
      roomId: string;
      streamId: string;
    };
  }, [liveStreamId, role]);

  const cleanup = useCallback(async () => {
    const zg = engineRef.current;
    if (!zg) return;

    try {
      if (role === "host") {
        zg.stopPublishingStream(streamId);
      }
      if (playingStreamIdRef.current) {
        zg.stopPlayingStream(playingStreamIdRef.current);
        playingStreamIdRef.current = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      zg.logoutRoom(roomId);
      zg.destroyEngine();
    } catch (e) {
      console.error("Zego cleanup error:", e);
    }

    engineRef.current = null;
    localStreamRef.current = null;
    joinedRef.current = false;
    setIsPlaying(false);
    setIsVolumeMuted(false);
    setListeners([]);
  }, [role, roomId, streamId]);

  const sendChat = useCallback(
    async (text: string) => {
      const zg = engineRef.current;
      if (!zg || !text.trim() || connectionState !== "connected") return false;

      const now = Date.now();
      if (now - lastSendRef.current < 500) return false;
      lastSendRef.current = now;

      const payload = JSON.stringify({
        type: "chat",
        userId,
        name: userName,
        text: text.trim().slice(0, 500),
      });

      try {
        const result = await zg.sendBroadcastMessage(roomId, payload);
        if (result?.errorCode && result.errorCode !== 0) {
          return false;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `${userId}-${now}`,
            userId,
            name: userName,
            text: text.trim().slice(0, 500),
            sendTime: now,
            isSelf: true,
            isHost: role === "host",
          },
        ]);
        return true;
      } catch {
        return false;
      }
    },
    [connectionState, roomId, role, userId, userName]
  );

  const toggleMute = useCallback(() => {
    const zg = engineRef.current;
    if (!zg || role !== "host") return;
    const next = !isMuted;
    zg.muteMicrophone(next);
    setIsMuted(next);
  }, [isMuted, role]);

  const toggleVolume = useCallback(() => {
    if (!remoteAudioRef.current) return;
    const next = !remoteAudioRef.current.muted;
    remoteAudioRef.current.muted = next;
    setIsVolumeMuted(next);
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !liveStreamId) return;

    let cancelled = false;

    const init = async () => {
      setConnectionState("connecting");
      setError(null);

      try {
        const { ZegoExpressEngine } = await import("zego-express-engine-webrtc");
        const tokenData = await fetchToken();

        if (cancelled) return;

        const appId = parseInt(
          process.env.NEXT_PUBLIC_ZEGO_APP_ID || String(tokenData.appId),
          10
        );
        const server =
          process.env.NEXT_PUBLIC_ZEGO_SERVER_URL ||
          "wss://webliveroom-api.zego.im/ws";

        const zg = new ZegoExpressEngine(appId, server) as ZegoEngine;
        engineRef.current = zg;

        zg.on("roomStateUpdate", (...args: unknown[]) => {
          const state = args[1] as string;
          if (state === "CONNECTED") setConnectionState("connected");
          if (state === "DISCONNECTED") setConnectionState("ended");
        });

        zg.on("roomOnlineUserCountUpdate", (...args: unknown[]) => {
          const count = args[1] as number;
          if (typeof count === "number") setListenerCount(count);
        });

        zg.on("roomUserUpdate", (...args: unknown[]) => {
          const updateRoomId = args[0] as string;
          const updateType = args[1] as "DELETE" | "ADD";
          const userList = args[2] as Array<{
            userID: string;
            userName?: string;
          }>;

          if (updateRoomId !== roomId || !Array.isArray(userList)) return;

          if (
            updateType === "DELETE" &&
            role === "audience" &&
            userList.some((user) => user.userID === hostUserId)
          ) {
            if (playingStreamIdRef.current) {
              zg.stopPlayingStream(playingStreamIdRef.current);
              playingStreamIdRef.current = null;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.pause();
              remoteAudioRef.current.srcObject = null;
            }
            setIsPlaying(false);
            setConnectionState("ended");
          }

          setListeners((prev) => {
            if (updateType === "ADD") {
              const now = Date.now();
              const next = [...prev];
              userList.forEach((user) => {
                if (user.userID === hostUserId) return;
                if (next.some((listener) => listener.userId === user.userID)) return;
                next.push({
                  userId: user.userID,
                  name: user.userName?.trim() || "Listener",
                  joinedAt: now,
                });
              });
              return next.sort((a, b) => a.joinedAt - b.joinedAt);
            }

            const removedIds = new Set(userList.map((user) => user.userID));
            return prev.filter((listener) => !removedIds.has(listener.userId));
          });
        });

        zg.on("IMRecvBroadcastMessage", (...args: unknown[]) => {
          const chatData = args[1] as Array<{
            fromUser: { userID: string; userName: string };
            message: string;
            sendTime: number;
          }>;
          if (!Array.isArray(chatData)) return;

          const incoming = chatData
            .map((item) =>
              parseChatPayload(
                item.message,
                item.fromUser.userID,
                item.fromUser.userName,
                item.sendTime,
                userId
              )
            )
            .filter(Boolean) as LiveChatMessage[];

          if (incoming.length === 0) return;

          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            incoming.forEach((msg) => {
              if (!ids.has(msg.id)) merged.push(msg);
            });
            return merged.sort((a, b) => a.sendTime - b.sendTime);
          });
        });

        if (role === "audience") {
          zg.on("roomStreamUpdate", async (...args: unknown[]) => {
            const updateType = args[1] as string;
            const streamList = args[2] as Array<{ streamID: string }>;
            if (!Array.isArray(streamList) || streamList.length === 0) return;

            if (updateType === "ADD") {
              const target =
                streamList.find((s) => s.streamID === streamId) || streamList[0];
              if (!target || playingStreamIdRef.current) return;

              try {
                const remoteStream = await zg.startPlayingStream(
                  target.streamID,
                  { roomID: roomId }
                );
                playingStreamIdRef.current = target.streamID;

                if (!remoteAudioRef.current) {
                  remoteAudioRef.current = document.createElement("audio");
                  remoteAudioRef.current.autoplay = true;
                }
                remoteAudioRef.current.srcObject = remoteStream;
                await remoteAudioRef.current.play().catch(() => undefined);
                setIsPlaying(true);
              } catch (e) {
                console.error("Play stream failed:", e);
              }
            } else if (updateType === "DELETE") {
              const hostStreamStopped = streamList.some(
                (s) =>
                  playingStreamIdRef.current === s.streamID ||
                  s.streamID === streamId
              );

              streamList.forEach((s) => {
                if (playingStreamIdRef.current === s.streamID) {
                  zg.stopPlayingStream(s.streamID);
                  playingStreamIdRef.current = null;
                }
              });

              if (hostStreamStopped) {
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.pause();
                  remoteAudioRef.current.srcObject = null;
                }
                setIsPlaying(false);
                setConnectionState("ended");
              }
            }
          });
        }

        zg.on("tokenWillExpire", async () => {
          try {
            const fresh = await fetchToken();
            zg.renewToken(fresh.token, roomId);
          } catch (e) {
            console.error("Token renew failed:", e);
          }
        });

        const loggedIn = await zg.loginRoom(
          roomId,
          tokenData.token,
          { userID: userId, userName: userName },
          { userUpdate: true }
        );

        if (!loggedIn || cancelled) {
          setConnectionState("error");
          setError("Failed to join the live room");
          return;
        }

        joinedRef.current = true;

        if (role === "host") {
          const localStream = await zg.createZegoStream({
            camera: { audio: true, video: false },
          });
          localStreamRef.current = localStream;
          zg.startPublishingStream(streamId, localStream, { roomID: roomId });
        }

        setConnectionState("connected");
      } catch (e: unknown) {
        console.error("Zego init failed:", e);
        if (!cancelled) {
          setConnectionState("error");
          setError(
            e instanceof Error ? e.message : "Failed to connect to live stream"
          );
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    enabled,
    userId,
    userName,
    liveStreamId,
    roomId,
    streamId,
    role,
    hostUserId,
    fetchToken,
    cleanup,
  ]);

  return {
    connectionState,
    isMuted,
    isPlaying,
    listenerCount,
    listeners,
    messages,
    error,
    sendChat,
    toggleMute,
    isVolumeMuted,
    toggleVolume,
    cleanup,
  };
}
