import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/providers/Providers";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getSiteUrl } from "@/lib/voiceShareMetadata";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Into Voice",
    template: "%s | Into Voice",
  },
  description: "Discover and share audio content on Into Voice",
  applicationName: "Into Voice",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/intovoice_logo_icon.png", type: "image/png" }],
    shortcut: ["/intovoice_logo_icon.png"],
    apple: [{ url: "/intovoice_logo_icon.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Into Voice",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    siteName: "Into Voice",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
          <ToastContainer position="top-right" autoClose={3000} />
        </Providers>
      </body>
    </html>
  );
}
