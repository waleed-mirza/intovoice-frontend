"use client";

import NextTopLoader from "nextjs-toploader";
import { AuthProvider } from "@/providers/AuthProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NextTopLoader
        color="#000000"
        height={2}
        showSpinner={false}
        shadow={false}
        easing="ease"
        speed={200}
      />
      {children}
    </AuthProvider>
  );
}
