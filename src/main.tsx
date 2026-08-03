import { createRoot } from "react-dom/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const rootEl = document.getElementById("root")!;

/** Render a full-screen startup diagnostic panel. */
function renderStartupError(opts: {
  title: string;
  kicker?: string;
  message: string;
  hint?: string;
  showReload?: boolean;
}) {
  const { title, kicker = "Startup issue", message, hint, showReload = true } = opts;
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0f;color:#f5f5f7;font-family:Inter,system-ui,sans-serif;padding:24px;">
      <div style="max-width:560px;border:1px solid #2a2a33;border-radius:12px;padding:28px;background:#12121a;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#f5a524;margin-bottom:12px;">${kicker}</div>
        <h1 style="font-size:22px;margin:0 0 12px;font-weight:600;">${title}</h1>
        <p style="margin:0 0 16px;color:#c7c7d1;line-height:1.55;">${message}</p>
        ${hint ? `<p style="margin:0 0 20px;color:#8a8a95;font-size:13px;line-height:1.55;">${hint}</p>` : ""}
        ${
          showReload
            ? `<button id="__sv_reload" style="appearance:none;border:1px solid #2a2a33;background:#1c1c26;color:#f5f5f7;padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer;">Retry now</button>`
            : ""
        }
      </div>
    </div>`;
  if (showReload) {
    document.getElementById("__sv_reload")?.addEventListener("click", () => window.location.reload());
  }
}

/** Retry a promise-returning fn with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3, baseMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = baseMs * 2 ** attempt + Math.floor(Math.random() * 150);
      // eslint-disable-next-line no-console
      console.warn(`[startup:${label}] attempt ${attempt + 1} failed, retrying in ${delay}ms`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Lightweight reachability probe against the backend REST root. */
async function probeBackend(url: string, key: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: key },
      signal: controller.signal,
    });
    // Any HTTP response (even 4xx) means the backend is reachable; only network
    // failures / aborts should trigger a retry.
    if (!res) throw new Error("no response");
  } finally {
    clearTimeout(timeout);
  }
}

const missingEnv = missingPublicEnv((name) =>
  name === "VITE_SUPABASE_URL" ? SUPABASE_URL : name === "VITE_SUPABASE_PUBLISHABLE_KEY" ? SUPABASE_KEY : undefined,
);

if (missingEnv.length > 0) {
  const missing = missingEnv.join(", ");

  renderStartupError({
    kicker: "Configuration error",
    title: "Backend environment is not configured",
    message: `The app cannot start because required environment variables are missing: <code style="color:#ffb4b4;">${missing}</code>.`,
    hint: "In Lovable, reconnect Lovable Cloud (or verify the project&rsquo;s <code>.env</code>) so these variables are injected at build time, then reload the preview. No secret values are shown on this page.",
  });
  // eslint-disable-next-line no-console
  console.error(`[startup] Missing Supabase env vars: ${missing}`);
} else {
  void (async () => {
    // Render the public UI before an optional backend reachability probe.
    // A temporary backend cold start must not turn into a full-screen startup
    // failure: route-level data loading will surface its own actionable state.
    // Chunk loading still has retries because no UI can render without it.
    // 2) Chunk loading with retry — protects against flaky preview asset fetches.
    try {
      const [{ default: App }, { HelmetProvider }] = await withRetry(
        () =>
          Promise.all([
            import("./App.tsx"),
            import("react-helmet-async"),
          ]),
        "app-bundle",
        2,
        300,
      );
      await withRetry(() => import("./index.css"), "styles", 2, 300);
      await withRetry(() => import("./i18n"), "i18n", 2, 300);

      createRoot(rootEl).render(
        <HelmetProvider>
          <App />
        </HelmetProvider>,
      );

      // Diagnostic only — never block a usable public shell on this probe.
      void withRetry(() => probeBackend(SUPABASE_URL, SUPABASE_KEY), "backend-probe", 3, 500)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("[startup] backend probe failed after UI render", err);
        });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[startup] failed to load app bundle", err);
      renderStartupError({
        kicker: "Load failed",
        title: "Couldn&rsquo;t load the application",
        message: "One of the app modules failed to download after multiple attempts.",
        hint: "This is almost always a temporary network hiccup — retry to reload the preview.",
      });
    }
  })();
}
