/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? "/LM-3D" : "";

const nextConfig = {
  ...(isGitHubPages ? { output: "export" } : {}),
  basePath,
  assetPrefix: isGitHubPages ? `${basePath}/` : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  images: {
    unoptimized: true
  },
  transpilePackages: ["@lm-3d/shared"]
};

export default nextConfig;
