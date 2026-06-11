"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "@/components/voice/VoiceIcons";

interface StationOption {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string | null;
}

interface LiveSetupFormProps {
  stations: StationOption[];
  onSubmit: (data: {
    title: string;
    description: string;
    stationId: string | null;
  }) => Promise<void>;
  submitting?: boolean;
}

const LiveSetupForm = ({
  stations,
  onSubmit,
  submitting = false,
}: LiveSetupFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [broadcastAs, setBroadcastAs] = useState<"self" | "station">("self");
  const [stationId, setStationId] = useState("");
  const [micReady, setMicReady] = useState(false);
  const [micChecking, setMicChecking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (broadcastAs === "station" && stations.length > 0 && !stationId) {
      setStationId(stations[0].id);
    }
  }, [broadcastAs, stations, stationId]);

  const requestMic = async () => {
    setMicChecking(true);
    setMicError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicReady(true);
    } catch {
      setMicError("Microphone access is required to go live");
      setMicReady(false);
    } finally {
      setMicChecking(false);
    }
  };

  useEffect(() => {
    requestMic();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit =
    title.trim().length > 0 && micReady && !submitting && !micChecking;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      stationId: broadcastAs === "station" ? stationId || null : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="What are you talking about?"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Optional details for listeners"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1 text-right">
          {description.length}/300
        </p>
      </div>

      {stations.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Broadcast as
          </label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setBroadcastAs("self")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                broadcastAs === "self"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Myself
            </button>
            <button
              type="button"
              onClick={() => setBroadcastAs("station")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                broadcastAs === "station"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Station
            </button>
          </div>

          {broadcastAs === "station" && (
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (@{s.handle})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Microphone check</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {micChecking
                ? "Requesting access…"
                : micReady
                  ? "Microphone ready"
                  : micError || "Microphone not available"}
            </p>
          </div>
          {micChecking ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : micReady ? (
            <div className="flex items-end gap-0.5 h-5">
              {[2, 4, 3, 5, 2].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-gray-700"
                  style={{
                    height: `${h * 3}px`,
                    animation: `voiceCommentPulse 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={requestMic}
              className="text-sm text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Start broadcast
        </button>
      </div>
    </form>
  );
};

export default LiveSetupForm;
