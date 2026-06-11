"use client";

import React, { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Radio,
  Plus,
  User,
  Search,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Bell,
  Settings,
  Loader2,
} from "@/components/voice/VoiceIcons";
import { useAuth } from "@/providers/AuthProvider";
import Api from "@/lib/axios";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";

interface SubscribedStation {
  id: string;
  name: string;
  handle: string;
  avatarURL: string | null;
}

interface VoiceLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

const MAIN_ROUTES = ["/", "/live", "/explore", "/subscriptions", "/my-stations", "/settings"];

const VoiceLayout = ({ children, showBackButton }: VoiceLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [subscribedStations, setSubscribedStations] = useState<SubscribedStation[]>([]);
  const [showAllSubscriptions, setShowAllSubscriptions] = useState(false);
  const [checkingStation, setCheckingStation] = useState(false);

  const autoBackButton =
    !MAIN_ROUTES.includes(pathname) && !pathname.startsWith("/category");
  const shouldShowBackButton = showBackButton ?? autoBackButton;

  useEffect(() => {
    if (user) {
      Api.get("/voice/station/subscribed")
        .then((res) => setSubscribedStations(res.data.result || []))
        .catch(() => setSubscribedStations([]));
    }
  }, [user]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } finally {
      setLoggingOut(false);
    }
  };

  const renderProfileAvatar = () =>
    user?.profileImg ? (
      <img
        src={resolveVoiceAssetUrl(user.profileImg)}
        alt={user.name}
        className="w-8 h-8 rounded-full object-cover"
      />
    ) : (
      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
        <User className="w-5 h-5 text-gray-500" />
      </div>
    );

  const displayedStations = showAllSubscriptions
    ? subscribedStations
    : subscribedStations.slice(0, 7);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleUploadClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!user) {
      router.push("/auth/login?redirect=/upload");
      return;
    }

    if (checkingStation) return;

    setCheckingStation(true);
    try {
      const res = await Api.get("/voice/station/my-stations");
      const stations = res.data.result || [];

      if (stations.length === 0) {
        router.push("/create-station");
      } else {
        router.push("/upload");
      }
    } catch (err) {
      console.error("Failed to check stations:", err);
      router.push("/upload");
    } finally {
      setCheckingStation(false);
    }
  };

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/live", icon: Radio, label: "Live" },
    { href: "/explore", icon: Compass, label: "Explore" },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const isStationActive = (stationId: string) =>
    pathname === `/station/${stationId}` ||
    pathname.startsWith(`/station/${stationId}/`);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center px-4">
        <div className="flex items-center gap-4 flex-1">
          {shouldShowBackButton && (
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full lg:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {user && (
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-full lg:hidden"
              aria-label="Open navigation menu"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}

          <Link href="/" className="flex items-center gap-2">
            <img
              src="/intovoice_logo.png"
              alt="Into Voice"
              className="h-8 w-auto object-contain sm:h-10 lg:h-12"
            />
            <span className="font-bold text-xl text-black">intoVoice</span>
          </Link>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-4 hidden sm:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Search stations, Audios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUploadClick}
            disabled={checkingStation}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Upload</span>
          </button>

          {user && (
            <Link
              href="/notifications"
              className="p-2 hover:bg-gray-100 rounded-full hidden sm:flex"
            >
              <Bell className="w-5 h-5 text-gray-600" />
            </Link>
          )}

          {userLoading ? (
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="p-2 hover:bg-gray-100 rounded-full flex items-center justify-center"
                aria-label="Account menu"
                aria-expanded={profileMenuOpen}
              >
                {renderProfileAvatar()}
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[70]">
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {loggingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
                          />
                        </svg>
                      )}
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => router.push("/auth/login?redirect=/")}
              className="px-4 py-2 text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <div className="fixed top-14 left-0 right-0 p-3 bg-white border-b border-gray-200 z-40 sm:hidden">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </form>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 lg:translate-x-0 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.href)
                  ? "bg-gray-900 text-white"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}

          <hr className="my-4" />

          {user && (
            <>
              <Link
                href="/settings"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("/settings")
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Account Settings</span>
              </Link>

              <Link
                href="/my-stations"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("/my-stations")
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Voice Stations</span>
              </Link>

              <Link
                href="/subscriptions"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("/subscriptions")
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Radio className="w-5 h-5" />
                <span className="font-medium">Friends Circle</span>
              </Link>

              <Link
                href="/notifications"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("/notifications")
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Bell className="w-5 h-5" />
                <span className="font-medium">Notifications</span>
              </Link>

              {subscribedStations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {displayedStations.map((station) => (
                    <Link
                      key={station.id}
                      href={`/station/${station.id}`}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                        isStationActive(station.id)
                          ? "bg-gray-900 text-white"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {station.avatarURL ? (
                        <Image
                          src={station.avatarURL}
                          alt={station.name}
                          width={24}
                          height={24}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                          <Radio className="w-3 h-3 text-gray-500" />
                        </div>
                      )}
                      <span className="text-sm truncate">{station.name}</span>
                    </Link>
                  ))}

                  {subscribedStations.length > 7 && (
                    <button
                      onClick={() => setShowAllSubscriptions(!showAllSubscriptions)}
                      className="flex items-center gap-3 px-4 py-2 w-full text-left rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                    >
                      {showAllSubscriptions ? (
                        <>
                          <ChevronUp className="w-5 h-5" />
                          <span className="text-sm">Show less</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-5 h-5" />
                          <span className="text-sm">
                            Show {subscribedStations.length - 7} more
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="pt-14 lg:pl-64 pb-40 md:pb-36 lg:pb-24">
        <div className="pt-[60px] sm:pt-0">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-40 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              isActive(item.href) ? "text-gray-900" : "text-gray-500"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={handleUploadClick}
          disabled={checkingStation}
          className="flex flex-col items-center gap-1 px-4 py-2 text-gray-500 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">Upload</span>
        </button>
      </nav>
    </div>
  );
};

export default VoiceLayout;
