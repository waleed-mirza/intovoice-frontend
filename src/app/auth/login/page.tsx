"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Api from "@/lib/axios";
import { useAuth } from "@/providers/AuthProvider";
import PasswordInput from "@/components/auth/PasswordInput";
import { Loader2 } from "@/components/voice/VoiceIcons";

type LoginForm = {
  email: string;
  password: string;
};

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { user, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginForm>();

  useEffect(() => {
    if (user && !isLoading && !justLoggedIn) {
      router.push(redirect);
    }
  }, [user, isLoading, justLoggedIn, router, redirect]);

  const onSubmit = (data: LoginForm) => {
    setIsLoading(true);
    setJustLoggedIn(true);
    setError(null);
    Api.post("/auth/login", data)
      .then((res) => {
        if (res.data.token) {
          localStorage.setItem("auth_token", res.data.token);
        }
        setUser(res.data.user);
        reset();
        sessionStorage.removeItem("notification_banner_dismissed");
        router.push(redirect);
      })
      .catch(() => {
        setError("Invalid email or password");
        setJustLoggedIn(false);
      })
      .finally(() => setIsLoading(false));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/intovoice_logo.png"
              alt="Into Voice"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">intoVoice</h1>
          <p className="text-gray-500 mt-2">Sign in to continue</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register("email", { required: "Email is required" })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <PasswordInput
              {...register("password", {
                required: "Password is required",
                minLength: { value: 6, message: "At least 6 characters" },
              })}
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Sign In
          </button>

          <p className="text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-gray-900 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
