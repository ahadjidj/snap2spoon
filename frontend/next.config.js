/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
    ],
  },
  // The browser always calls /api/* on the frontend origin; Next.js proxies
  // to the actual api-service. This avoids baking a per-environment URL into
  // the client bundle and sidesteps CORS entirely.
  async rewrites() {
    const target = process.env.API_URL_INTERNAL || "http://api:8000";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};
module.exports = nextConfig;
