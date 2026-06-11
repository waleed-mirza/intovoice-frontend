/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.*.amazonaws.com" },
    ],
  },
  // Zego WebRTC SDK is browser-only; keep it out of the server bundle (Netlify/SSR builds).
  experimental: {
    serverComponentsExternalPackages: ["zego-express-engine-webrtc"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "zego-express-engine-webrtc",
      ];
    }
    return config;
  },
};

export default nextConfig;
