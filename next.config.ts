import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.telegram.org",
      },
    ],
  },
  // Важно для Telegram WebApp
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://web.telegram.org https://telegram.org https://*.telegram.org;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
