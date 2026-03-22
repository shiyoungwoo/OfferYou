/** @type {import("next").NextConfig} */
const nextConfig = {
  typedRoutes: true,
  webpack(config, { dev }) {
    if (dev) {
      // This repo lives in an iCloud-synced folder, and Next's filesystem cache
      // can intermittently lose pack files there during `next dev`.
      config.cache = false;
    }

    return config;
  }
};

module.exports = nextConfig;
