import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "playwright",
    "pdf-parse",
    "mammoth",
    "tesseract.js",
    "@tesseract.js-data/eng",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
