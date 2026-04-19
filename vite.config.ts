import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "web-worker": "identity-obj-proxy",
    },
  },
  optimizeDeps: {
    exclude: ['web-worker']
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    cssCodeSplit: true,
    commonjsOptions: {
      ignore: ['web-worker']
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'editor': [
            '@uiw/react-codemirror',
            '@codemirror/lang-sql',
            '@codemirror/merge',
            '@replit/codemirror-minimap'
          ],
          'diagram': [
            '@xyflow/react',
            'elkjs',
            'dagre'
          ],
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
          'query': ['@tanstack/react-query', '@supabase/supabase-js'],
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
        timeout: 600000,
        proxyTimeout: 600000,
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
}));
