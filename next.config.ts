import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Note: a service worker is served from /public/sw.js and registered by the
// notifications settings page. We previously used @ducanh2912/next-pwa, but it
// is not compatible with Next.js Turbopack and silently produced no output.

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: "/home/verrel/Documents/coding/vibe/claude-code/ralts",
  },
};

export default withNextIntl(nextConfig);
