"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import {
  Loader2,
  BarChart3,
  Users,
  Play,
  Heart,
  MessageCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  FileAudio,
  ChevronLeft,
} from "@/components/voice/VoiceIcons";

interface TopPost {
  id: string;
  title: string;
  thumbnailURL: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

interface Analytics {
  basicStats: {
    totalPosts: number;
    totalSubscribers: number;
    totalPlays: number;
    totalLikes: number;
    totalComments: number;
  };
  topPosts: { byViews: TopPost[]; byLikes: TopPost[] };
  growth: {
    subscribersThisWeek: number;
    subscribersThisMonth: number;
    postsThisWeek: number;
    postsThisMonth: number;
    viewsThisWeek: number;
    viewsThisMonth: number;
  };
}

interface Station {
  id: string;
  name: string;
  handle: string;
  avatarURL: string | null;
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color = "purple",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  color?: "purple" | "blue" | "green" | "pink" | "orange";
}) => {
  const colorClasses = {
    purple: "bg-gray-100 text-gray-700",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    pink: "bg-pink-50 text-pink-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && trend !== "neutral" && (
          <div
            className={`flex items-center text-xs font-medium ${
              trend === "up" ? "text-green-600" : "text-red-500"
            }`}
          >
            {trend === "up" ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
      </div>
    </div>
  );
};

const TopPostItem = ({ post, rank }: { post: TopPost; rank: number }) => (
  <Link
    href={`/post/${post.id}`}
    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
  >
    <span className="text-lg font-bold text-gray-300 w-6">{rank}</span>
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
      {post.thumbnailURL ? (
        <img src={post.thumbnailURL} alt={post.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileAudio className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          {post.viewCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          {post.likeCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          {post.commentCount.toLocaleString()}
        </span>
      </div>
    </div>
  </Link>
);

export default function AnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user, userLoading } = useAuth();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"views" | "likes">("views");

  useEffect(() => {
    if (userLoading) return;
    if (!user && !loading) {
      router.push(`/auth/login?redirect=/station/${id}/analytics`);
    }
  }, [user, loading, router, id, userLoading]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [analyticsRes, stationRes] = await Promise.all([
          Api.get(`/voice/station/${id}/analytics`),
          Api.get(`/voice/station/${id}`),
        ]);
        setAnalytics(analyticsRes.data.result);
        setStation(stationRes.data.result);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setError("You don't have permission to view this station's analytics");
        } else if (status === 404) {
          setError("Station not found");
        } else {
          setError("Failed to load analytics");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!analytics || !station) return null;

  const { basicStats, topPosts, growth } = analytics;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-full hidden lg:flex"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          {station.avatarURL ? (
            <img
              src={station.avatarURL}
              alt={station.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold">
              {station.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Station Analytics</h1>
            <p className="text-sm text-gray-500">@{station.handle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <StatCard icon={FileAudio} label="Total Audios" value={basicStats.totalPosts} color="purple" />
        <StatCard
          icon={Users}
          label="Friends"
          value={basicStats.totalSubscribers}
          subValue={`+${growth.subscribersThisWeek} this week`}
          trend={growth.subscribersThisWeek > 0 ? "up" : "neutral"}
          color="blue"
        />
        <StatCard
          icon={Play}
          label="Total Plays"
          value={basicStats.totalPlays}
          subValue={`+${growth.viewsThisWeek} this week`}
          trend={growth.viewsThisWeek > 0 ? "up" : "neutral"}
          color="green"
        />
        <StatCard icon={Heart} label="Total Likes" value={basicStats.totalLikes} color="pink" />
        <StatCard
          icon={MessageCircle}
          label="Total Comments"
          value={basicStats.totalComments}
          color="orange"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Growth Overview</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">New Friends</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {growth.subscribersThisWeek}
              </span>
              <span className="text-sm text-gray-400">this week</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{growth.subscribersThisMonth} this month</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">New Audios</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{growth.postsThisWeek}</span>
              <span className="text-sm text-gray-400">this week</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{growth.postsThisMonth} this month</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Listens</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {growth.viewsThisWeek.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">this week</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {growth.viewsThisMonth.toLocaleString()} this month
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Avg. Listens/Audio</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {basicStats.totalPosts > 0
                  ? Math.round(basicStats.totalPlays / basicStats.totalPosts).toLocaleString()
                  : 0}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">all time average</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Top Audios</h2>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab("views")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === "views"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              By Listens
            </button>
            <button
              onClick={() => setActiveTab("likes")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === "likes"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              By Likes
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {(activeTab === "views" ? topPosts.byViews : topPosts.byLikes).length > 0 ? (
            (activeTab === "views" ? topPosts.byViews : topPosts.byLikes).map((post, index) => (
              <TopPostItem key={post.id} post={post} rank={index + 1} />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <FileAudio className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No Audios yet</p>
              <Link href="/upload" className="text-gray-700 hover:underline text-sm mt-2 inline-block">
                Upload your first audio
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
