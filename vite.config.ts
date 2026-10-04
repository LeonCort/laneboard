import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Laneboard",
        short_name: "Laneboard",
        description: "Local-first service blueprint canvas",
        theme_color: "#2e5bda",
        background_color: "#f6f7f9",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // The app registers its worker directly; activate updated assets without closing every tab.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2,json}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  preview: {
    headers: Object.fromEntries(
      JSON.parse(
        readFileSync(new URL("./vercel.json", import.meta.url), "utf8"),
      ).headers[0].headers.map((h: { key: string; value: string }) => [
        h.key,
        h.value,
      ]),
    ),
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
  },
  build: { sourcemap: false },
});
