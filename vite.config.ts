import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { prerender } from "./scripts/prerender-routes";
import { REQUIRED_PUBLIC_ENV } from "./src/lib/config/requiredEnv";

/**
 * Mirror the SDK-owned MCP manifest at .lovable/mcp/manifest.json into
 * public/.lovable/mcp/manifest.json so the manifest served from the deployed
 * site (and read by McpHealthCenter / SettingsIntegrationsAI) never drifts
 * from the tool list bundled into the edge function. Runs on dev start,
 * on source-manifest change, and before every build.
 */
function syncMcpManifestToPublic() {
  const src = path.resolve(__dirname, ".lovable/mcp/manifest.json");
  const dst = path.resolve(__dirname, "public/.lovable/mcp/manifest.json");
  const copy = () => {
    try {
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[mcp-manifest-sync] failed to copy manifest:", err);
    }
  };
  return {
    name: "streamvista-mcp-manifest-sync",
    enforce: "post" as const,
    buildStart() {
      copy();
    },
    configureServer(server: { watcher: { add: (p: string) => void; on: (e: string, cb: (p: string) => void) => void } }) {
      copy();
      server.watcher.add(src);
      const onChange = (file: string) => {
        if (path.resolve(file) === src) copy();
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
    },
  };
}


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

/**
 * Fail the production build early — with variable NAMES only, never values —
 * when the browser-safe backend configuration is missing. Prevents shipping a
 * bundle whose Supabase client initializes with `undefined`.
 */
function requirePublicEnv(resolved: Record<string, string | undefined>) {
  return {
    name: "streamvista-require-public-env",
    apply: "build" as const,
    buildStart() {
      const missing = REQUIRED_PUBLIC_ENV.filter((key) => {
        const value = resolved[key];
        return !value || value.trim().length === 0;
      });
      if (missing.length) {
        throw new Error(
          `[config] Missing required build-time environment variable(s): ${missing.join(", ")}. ` +
            `Reconnect Lovable Cloud (or set them in .env) and rebuild. No values are logged.`,
        );
      }
      // eslint-disable-next-line no-console
      console.log(`[config] backend configuration present (${REQUIRED_PUBLIC_ENV.join(", ")})`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    env.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl) process.env.VITE_SUPABASE_URL = supabaseUrl;
  if (supabasePublishableKey) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supabasePublishableKey;

  const envDefine: Record<string, string> = {};
  if (supabaseUrl) envDefine["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(supabaseUrl);
  if (supabasePublishableKey) envDefine["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(supabasePublishableKey);

  return {
    define: envDefine,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    },
    plugins: [
      react(),
      mcpPlugin(),
      syncMcpManifestToPublic(),
      mode === "development" && componentTagger(),
      mode !== "development" && prerenderRoutes(),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
