"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Api from "@/lib/axios";
import { NotificationProvider } from "@/hooks/useNotifications";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  profileImg?: string | null;
  username?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  userLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  verifyAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const verifyAuth = useCallback(async () => {
    try {
      setUserLoading(true);
      const res = await Api.get("/auth/verify");
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.post("/auth/logout");
    } catch {
      // Clear local session even if the request fails
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  return (
    <AuthContext.Provider value={{ user, userLoading, setUser, verifyAuth, logout }}>
      <NotificationProvider user={user}>{children}</NotificationProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
