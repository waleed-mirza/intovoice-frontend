"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Api from "@/lib/axios";
import type { AuthUser } from "@/providers/AuthProvider";

type NotificationContextType = {
  unreadCount: number;
  refreshUnreadCount: () => void;
  decrementUnreadCount: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: AuthUser | null;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    if (user?.id) {
      try {
        const res = await Api.get("/notification/unreadcount");
        setUnreadCount(res.data.count);
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    }
  };

  const decrementUnreadCount = () => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    refreshUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        decrementUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
