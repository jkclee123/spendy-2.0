import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Spendy",
        short_name: "Spendy",
        description: "Track your spending with ease",
        start_url: "/transactions",
        display: "standalone",
        background_color: "#030712",
        theme_color: "#1191BF",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        categories: ["finance", "utilities"],
        shortcuts: [
          {
            name: "View Transactions",
            short_name: "Transactions",
            url: "/transactions",
          },
          {
            name: "View Charts",
            short_name: "Charts",
            url: "/charts",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api/transactions/create": {
        target: "http://localhost:54321/functions/v1/create-transaction",
        changeOrigin: true,
        rewrite: () => "",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
