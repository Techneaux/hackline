import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/node-heavy server deps that must not be bundled.
  serverExternalPackages: ["better-sqlite3", "node-ical", "google-auth-library"],
};

export default nextConfig;
