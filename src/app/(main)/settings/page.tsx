"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/voice/ImageUploader";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import { resolveVoiceAssetUrl } from "@/lib/resolveVoiceAssetUrl";
import {
  Loader2,
  Check,
  X,
  Settings,
  AlertCircle,
} from "@/components/voice/VoiceIcons";

export default function SettingsPage() {
  const router = useRouter();
  const { user, userLoading, setUser, logout } = useAuth();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [profileImg, setProfileImg] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(true);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/settings");
      return;
    }
    setName(user.name || "");
    setUsername(user.username || "");
    setOriginalUsername(user.username || "");
    setProfileImg(user.profileImg || "");
    setEmail(user.email || "");
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!username) {
      setUsernameAvailable(null);
      return;
    }
    if (username === originalUsername) {
      setUsernameAvailable(true);
      return;
    }
    const timer = setTimeout(async () => {
      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        return;
      }
      try {
        setCheckingUsername(true);
        const res = await Api.get(`/auth/check-username/${username}`);
        setUsernameAvailable(res.data.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, originalUsername]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || name.length < 3) {
      setProfileError("Name must be at least 3 characters");
      return;
    }
    if (username && username.length < 3) {
      setProfileError("Username must be at least 3 characters");
      return;
    }
    if (usernameAvailable === false) {
      setProfileError("This username is already taken");
      return;
    }
    try {
      setProfileSaving(true);
      setProfileError(null);
      setProfileSuccess(null);
      const res = await Api.patch("/auth/profile", {
        name,
        username: username || null,
        profileImg: profileImg || null,
      });
      setUser(res.data.user);
      setOriginalUsername(res.data.user.username || "");
      setProfileSuccess("Profile updated successfully");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update profile";
      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPassword) {
      setEmailError("Current password is required");
      return;
    }
    try {
      setEmailSaving(true);
      setEmailError(null);
      setEmailSuccess(null);
      const res = await Api.patch("/auth/email", {
        email,
        currentPassword: emailPassword,
      });
      setUser(res.data.user);
      setEmailPassword("");
      setEmailSuccess("Email updated successfully");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update email";
      setEmailError(message);
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    try {
      setPasswordSaving(true);
      setPasswordError(null);
      setPasswordSuccess(null);
      await Api.patch("/auth/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated successfully");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update password";
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push("/");
    } finally {
      setLoggingOut(false);
    }
  };

  if (userLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
        <p className="text-gray-500 animate-pulse">Loading account settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-700">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500">Manage your profile, email, and password</p>
        </div>
      </div>

      <div className="space-y-8">
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            <ImageUploader
              value={resolveVoiceAssetUrl(profileImg)}
              onChange={setProfileImg}
              type="avatar"
              className="w-32"
            />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                  }
                  maxLength={30}
                  placeholder="yourname"
                  className={`w-full pl-8 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                    usernameAvailable === false
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-200 focus:ring-gray-400"
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {checkingUsername && (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  )}
                  {!checkingUsername && usernameAvailable === true && username && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
              {usernameAvailable === false && (
                <p className="text-sm text-red-500 mt-1">This username is already taken</p>
              )}
            </div>
          </div>

          {profileError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm">
              {profileSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={
              profileSaving ||
              usernameAvailable === false ||
              !name ||
              name.length < 3
            }
            className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {profileSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving Profile...
              </>
            ) : (
              "Save Profile"
            )}
          </button>
        </form>

        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Email</h2>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Current Password *
              </label>
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
          </div>

          {emailError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {emailError}
            </div>
          )}
          {emailSuccess && (
            <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm">
              {emailSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={emailSaving || !email || !emailPassword}
            className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {emailSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating Email...
              </>
            ) : (
              "Update Email"
            )}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Password</h2>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Current Password *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Password *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm New Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                required
              />
            </div>
          </div>

          {passwordError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm">
              {passwordSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={
              passwordSaving ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {passwordSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating Password...
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </form>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Session</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sign out of your account on this device.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full py-3 border border-red-200 text-red-700 font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loggingOut ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing Out...
              </>
            ) : (
              "Sign Out"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
