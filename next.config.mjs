/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.*.amazonaws.com" },
      { protocol: "https", hostname: "s3.ap-northeast-1.amazonaws.com" },
    ],
    // Dev server often fails to fetch S3 for optimization (ECONNRESET); prod CDN handles it.
    unoptimized: process.env.NODE_ENV === "development",
  },
  // Zego WebRTC SDK is browser-only; keep it out of the server bundle (Netlify/SSR builds).
  experimental: {
    serverComponentsExternalPackages: ["zego-express-engine-webrtc"],
  },
};

export default nextConfig;
