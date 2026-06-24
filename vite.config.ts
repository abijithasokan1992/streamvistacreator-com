import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { prerender } from "./scripts/prerender-routes";

/**
 * Emit per-route static HTML shells with route-specific <title>, description,
 * canonical, og:* and twitter:* tags baked into the response body. Required
 * because Vite/SPA serves a single index.html for every path and social
 * crawlers don't execute the React Helmet head mutations.
 */
function prerenderRoutes() {
  return {
    name: "streamvista-prerender-routes",
    apply: "build" as const,
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const { written } = prerender(distDir);
      if (written.length) {
        // eslint-disable-next-line no-console
        console.log(`[prerender] wrote ${written.length} route shell(s): ${written.join(", ")}`);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode !== "development" && prerenderRoutes(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
