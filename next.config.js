/** @type {import("next").NextConfig} */
const nextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["better-sqlite3", "@playwright/test", "playwright", "playwright-core"],
  /** 仅开发模式禁用 webpack 缓存（iCloud 同步导致 pack 文件丢失） */
  webpack(config, { dev }) {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  /** 安全响应头（仅生产环境启用 CSP，避免阻断开发模式 WebSocket/热更新） */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.xiaomimimo.com https://api.openai.com;",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

module.exports = nextConfig;
