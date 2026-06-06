"use client";

import React, { useState } from "react";
import Api from "@/lib/axios";
import useSWR from "swr";
import moment from "moment";
import Link from "next/link";
import { BsBell, BsBellFill } from "react-icons/bs";
import {
  FaHeart,
  FaComment,
  FaPodcast,
  FaHeadphones,
  FaTrash,
} from "react-icons/fa";
import { IoCheckmarkDone } from "react-icons/io5";
import { MdClearAll } from "react-icons/md";
import { Loader2 } from "@/components/voice/VoiceIcons";
import { useAuth } from "@/providers/AuthProvider";
import { useNotifications } from "@/hooks/useNotifications";

const VOICE_TYPES = [
  "voice_subscription",
  "voice_new_post",
  "voice_like",
  "voice_comment",
] as const;

type VoiceNotificationType = (typeof VOICE_TYPES)[number];

const fetcher = (url: string) => Api.get(url).then((res) => res.data);

export default function NotificationsPage() {
  const { user, userLoading } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const { refreshUnreadCount, decrementUnreadCount } = useNotifications();

  const { data, isLoading, error, mutate } = useSWR(
    user ? "/notification/all" : null,
    fetcher
  );

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-6 px-4 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-700 mb-4">Please log in to view notifications</p>
          <Link
            href="/auth/login?redirect=/notifications"
            className="inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-6 px-4 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-red-500">Error loading notifications</p>
        </div>
      </div>
    );
  }

  const allNotifications =
    data?.data?.notifications || data?.notifications || data?.data || [];

  const voiceNotifications = allNotifications.filter((n: { type: string }) =>
    VOICE_TYPES.includes(n.type as VoiceNotificationType)
  );

  const notifications = voiceNotifications.filter((notification: { type: string }) => {
    if (filter === "all") return true;
    return notification.type === filter;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "voice_subscription":
        return <FaHeadphones className="text-purple-500" size={16} />;
      case "voice_new_post":
        return <FaPodcast className="text-purple-500" size={16} />;
      case "voice_like":
        return <FaHeart className="text-purple-500" size={16} />;
      case "voice_comment":
        return <FaComment className="text-purple-500" size={16} />;
      default:
        return <BsBell className="text-gray-500" size={16} />;
    }
  };

  const getNotificationMessage = (type: string) => {
    switch (type) {
      case "voice_subscription":
        return "is now a friend of your station";
      case "voice_new_post":
        return "posted new audio content";
      case "voice_like":
        return "liked your voice post";
      case "voice_comment":
        return "commented on your voice post";
      default:
        return "sent you a notification";
    }
  };

  const getContentLink = (notification: { type: string; content?: string }) => {
    if (!notification.content) return null;
    switch (notification.type) {
      case "voice_subscription":
        return `/station/${notification.content}`;
      case "voice_new_post":
      case "voice_like":
      case "voice_comment":
        return `/post/${notification.content}`;
      default:
        return null;
    }
  };

  const getViewButtonText = (type: string) => {
    switch (type) {
      case "voice_subscription":
        return "View Station";
      case "voice_new_post":
      case "voice_like":
      case "voice_comment":
        return "Listen";
      default:
        return "View";
    }
  };

  const handleNotificationRead = async (notificationId: string) => {
    if (markingAsRead === notificationId) return;
    setMarkingAsRead(notificationId);
    try {
      await Api.post(`/notification/mark-read/${notificationId}`);
      mutate();
      decrementUnreadCount();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Api.post("/notification/mark-all-read");
      mutate();
      refreshUnreadCount();
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (deletingId === notificationId) return;
    setDeletingId(notificationId);
    try {
      await Api.delete(`/notification/${notificationId}`);
      mutate();
      refreshUnreadCount();
    } catch (err) {
      console.error("Error deleting notification:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await Api.delete("/notification/clear-all");
      mutate();
      refreshUnreadCount();
    } catch (err) {
      console.error("Error clearing all notifications:", err);
    }
  };

  const unreadCount = notifications.filter((n: { read: boolean }) => !n.read).length;

  const formatTime = (time: string) => {
    const now = moment();
    const notificationTime = moment(time);
    const diffInMinutes = now.diff(notificationTime, "minutes");
    if (diffInMinutes < 1) return "moments ago";
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`;
    }
    return notificationTime.fromNow();
  };

  return (
    <div className="pt-6 px-4 max-w-4xl mx-auto pb-24">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col space-y-4 sm:space-y-6">
          <div className="flex flex-col space-y-4 border-b border-gray-200 pb-4 sm:pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <BsBellFill className="text-gray-900" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-600 truncate">
                  {unreadCount > 0
                    ? `${unreadCount} unread voice notification${unreadCount > 1 ? "s" : ""}`
                    : "All caught up!"}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="all">All Voice Notifications</option>
                <option value="voice_subscription">Voice Friends</option>
                <option value="voice_new_post">Voice New Posts</option>
                <option value="voice_like">Voice Likes</option>
                <option value="voice_comment">Voice Comments</option>
              </select>

              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    <IoCheckmarkDone size={14} />
                    Mark all as read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                  >
                    <MdClearAll size={14} />
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <BsBell className="text-gray-400 mx-auto mb-4" size={32} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
                <p className="text-gray-600">
                  Voice activity from friends, likes, and comments will show up here.
                </p>
              </div>
            ) : (
              notifications.map(
                (notification: {
                  id: string;
                  type: string;
                  content?: string;
                  read: boolean;
                  createdAt: string;
                  sender?: { id?: string; name?: string; username?: string };
                }) => (
                  <div
                    key={notification.id}
                    className={`relative p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                      notification.read
                        ? "bg-white border-gray-200"
                        : "bg-gray-50 border-gray-300 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 p-1.5 sm:p-2 bg-white rounded-lg border border-gray-200">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-1 leading-tight">
                          <span className="font-semibold text-gray-900">
                            {notification.sender?.name ||
                              notification.sender?.username ||
                              "Someone"}
                          </span>{" "}
                          {getNotificationMessage(notification.type)}
                        </p>
                        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                          <p className="text-xs text-gray-500">
                            {formatTime(notification.createdAt)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {getContentLink(notification) && (
                              <Link
                                href={getContentLink(notification)!}
                                onClick={() => {
                                  if (!notification.read) {
                                    handleNotificationRead(notification.id);
                                  }
                                }}
                                className="text-xs font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 sm:px-3 py-1 rounded-full"
                              >
                                {getViewButtonText(notification.type)}
                              </Link>
                            )}
                            {!notification.read && (
                              <button
                                onClick={() => handleNotificationRead(notification.id)}
                                disabled={markingAsRead === notification.id}
                                className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full disabled:opacity-50"
                              >
                                {markingAsRead === notification.id ? "..." : "✓"}
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              disabled={deletingId === notification.id}
                              className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-full disabled:opacity-50"
                            >
                              {deletingId === notification.id ? "..." : <FaTrash size={10} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
