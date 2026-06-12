"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Api from "@/lib/axios";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import type { LiveRoomListener } from "@/types/live";

interface LiveListenersPanelProps {
  liveStreamId: string;
  listeners: LiveRoomListener[];
}

interface ListenerProfile {
  id: string;
  name: string;
  username?: string | null;
  profileImg?: string | null;
}

const ListenerAvatar = ({
  name,
  profileImg,
}: {
  name: string;
  profileImg?: string | null;
}) => {
  const initial = name.charAt(0).toUpperCase() || "?";
  const avatarUrl = profileImg ? resolveVoiceAssetUrl(profileImg) : null;

  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={44}
          height={44}
          className="w-11 h-11 rounded-full object-cover bg-gray-100"
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
          {initial}
        </div>
      )}
      <span
        aria-hidden
        className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
      />
    </div>
  );
};

const LiveListenersPanel = ({ liveStreamId, listeners }: LiveListenersPanelProps) => {
  const [profiles, setProfiles] = useState<Record<string, ListenerProfile>>({});

  const listenerIdsKey = useMemo(
    () => listeners.map((listener) => listener.userId).sort().join(","),
    [listeners]
  );

  useEffect(() => {
    if (!liveStreamId || listeners.length === 0) {
      setProfiles({});
      return;
    }

    let cancelled = false;

    Api.post(`/voice/live/${liveStreamId}/listener-profiles`, {
      userIds: listeners.map((listener) => listener.userId),
    })
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, ListenerProfile> = {};
        (res.data.result as ListenerProfile[] | undefined)?.forEach((profile) => {
          next[profile.id] = profile;
        });
        setProfiles(next);
      })
      .catch(() => {
        if (!cancelled) setProfiles({});
      });

    return () => {
      cancelled = true;
    };
  }, [liveStreamId, listenerIdsKey, listeners.length]);

  const enrichedListeners = listeners.map((listener) => {
    const profile = profiles[listener.userId];
    return {
      ...listener,
      name: profile?.name || listener.name,
      profileImg: profile?.profileImg ?? listener.profileImg ?? null,
    };
  });

  return (
    <section className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-medium text-gray-900">Listeners</h2>
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-gray-100 text-xs font-medium text-gray-700 tabular-nums">
            {listeners.length}
          </span>
        </div>
        <p className="text-xs text-gray-500 shrink-0">Joined this broadcast</p>
      </div>

      {listeners.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-500">Waiting for listeners to join…</p>
          <p className="mt-1 text-xs text-gray-400">
            People who tune in will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="live-chat-scroll overflow-x-auto overscroll-x-contain">
          <ul className="flex items-start gap-3 px-4 py-4 min-w-min">
            {enrichedListeners.map((listener) => (
              <li
                key={listener.userId}
                className="flex flex-col items-center gap-2 w-[4.75rem] shrink-0"
              >
                <ListenerAvatar
                  name={listener.name}
                  profileImg={listener.profileImg}
                />
                <p
                  className="w-full text-center text-xs font-medium text-gray-800 truncate"
                  title={listener.name}
                >
                  {listener.name}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default LiveListenersPanel;
