import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/" : "/",
  build: {
    // Output to dist for Cloudflare Pages
    outDir: "dist",
    // Use directory structure compatible with Cloudflare Pages SPA
    assetsDir: "assets",
    // Enable CSS code splitting for better caching
    cssCodeSplit: true,
    // Manual chunks for better caching and parallel loading
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - loaded first
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // CodeMirror editor - heavy but needed for editor
          'editor': [
            '@uiw/react-codemirror',
            '@codemirror/lang-sql',
            '@codemirror/merge',
            '@replit/codemirror-minimap'
          ],
          // ER Diagram - heavy visualization
          'diagram': [
            '@xyflow/react',
            'elkjs',
            'dagre'
          ],
          // UI components - Radix primitives
          'ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-switch',
            '@radix-ui/react-slot'
          ],
          // Query client and data
          'query': ['@tanstack/react-query', '@supabase/supabase-js'],
          // Charts if used
          'charts': ['recharts'],
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        timeout: 600000,      // 10 minutes — agents can run long
        proxyTimeout: 600000, // 10 minutes — don't cut SSE streams
      },
      "/ai-api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-api/, ""),
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "resona.png"],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "Schema Weaver",
        short_name: "SchemaWeaver",
        description: "Database schema design and visualization tool",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/resona.png",
            sizes: "300x300",
            type: "image/png",
          },
          {
            src: "/resona.png",
            sizes: "300x300",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
