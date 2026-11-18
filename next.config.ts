import type { NextConfig } from "next";

const isPagesExport = process.env.PAGES_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isPagesExport
    ? {
        output: "export" as const,
        basePath: process.env.PAGES_BASE_PATH || undefined,
        trailingSlash: true,
      }
    : {}),
  serverExternalPackages: [
    "playwright",
    "pdf-parse",
    "mammoth",
    "tesseract.js",
    "@tesseract.js-data/eng",
  ],
  experimental: isPagesExport
    ? undefined
    : {
        serverActions: {
          bodySizeLimit: "8mb",
        },
      },
};

export default nextConfig;
