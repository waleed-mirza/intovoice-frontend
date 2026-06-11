"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LiveChatMessage } from "@/types/live";
import Toast from "@/utils/CustomToast";

interface LiveChatPanelProps {
  messages: LiveChatMessage[];
  onSend: (text: string) => Promise<boolean>;
  listenerCount?: number;
  hostUserId?: string;
  disabled?: boolean;
}

const LiveChatPanel = ({
  messages,
  onSend,
  listenerCount,
  hostUserId,
  disabled = false,
}: LiveChatPanelProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending || disabled) return;

    setSending(true);
    const ok = await onSend(text);
    setSending(false);

    if (ok) {
      setText("");
    } else {
      Toast("error", "Slow down — try again in a moment");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[280px] lg:min-h-[420px]">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Live chat</h2>
        {typeof listenerCount === "number" && listenerCount > 0 && (
          <span className="text-xs text-gray-500">{listenerCount} in room</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Say hello to the room
          </p>
        ) : (
          messages.map((msg) => {
            const isHostMsg = hostUserId && msg.userId === hostUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${msg.isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.isSelf
                      ? "bg-gray-900 text-white"
                      : `bg-gray-100 text-gray-900 ${
                          isHostMsg ? "border-l-2 border-gray-900" : ""
                        }`
                  }`}
                  style={{
                    animation: "none",
                  }}
                >
                  {!msg.isSelf && (
                    <p className="text-xs font-medium text-gray-500 mb-0.5">
                      {msg.name}
                      {isHostMsg ? " · Host" : ""}
                    </p>
                  )}
                  <p className="break-words">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-100 flex items-center gap-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a message…"
          maxLength={500}
          disabled={disabled || sending}
          className="flex-1 px-4 py-2 bg-gray-100 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default LiveChatPanel;
