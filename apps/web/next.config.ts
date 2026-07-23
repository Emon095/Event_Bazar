import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryPath = "/Event_Bazar";

const nextConfig: NextConfig = {
  ...(isGitHubPages ? {
    output: "export" as const,
    trailingSlash: true,
    basePath: repositoryPath,
    assetPrefix: repositoryPath,
  } : {}),
  images: {
    unoptimized: isGitHubPages,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "d112y698adiu2z.cloudfront.net" },
    ],
  },
};

export default nextConfig;
