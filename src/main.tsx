import { createRoot } from "react-dom/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const rootEl = document.getElementById("root")!;

function renderStartupError(opts: {
  title: string;
  kicker?: string;
  message: string;
  hint?: string;
  showReload?: boolean;
}) {
  const { title, kicker = "Startup issue", message, hint, showReload = true } = opts;
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#08090d;color:#fffdf7;font-family:Inter,system-ui,sans-serif;padding:24px;">
      <div style="max-width:560px;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:28px;background:rgba(255,255,255,.035);backdrop-filter:blur(16px);">
        <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#aaa7b0;margin-bottom:12px;">${kicker}</div>
        <h1 style="font-size:22px;margin:0 0 12px;font-weight:700;">${title}</h1>
        <p style="margin:0 0 16px;color:#c7c3cc;line-height:1.55;">${message}</p>
        ${hint ? `<p style="margin:0 0 20px;color:#aaa7b0;font-size:13px;line-height:1.55;">${hint}</p>` : ""}
        ${showReload ? `<button id="__sv_reload" style="appearance:none;border:1px solid rgba(255,255,255,.14);background:#f7f3eb;color:#101015;padding:10px 17px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;">Retry now</button>` : ""}
      </div>
    </div>`;
  if (showReload) {
    document.getElementById("__sv_reload")?.addEventListener("click", () => window.location.reload());
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3, baseMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = baseMs * 2 ** attempt + Math.floor(Math.random() * 150);
      console.warn(`[startup:${label}] attempt ${attempt + 1} failed, retrying in ${delay}ms`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

async function probeBackend(url: string, key: string): Promise<void> {
  if (!url || !key) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: key },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

void (async () => {
  try {
    const [{ default: App }, { HelmetProvider }] = await withRetry(
      () => Promise.all([import("./App.tsx"), import("react-helmet-async")]),
      "app-bundle",
      2,
      300,
    );
    await withRetry(() => import("./index.css"), "styles", 2, 300);
    await withRetry(() => import("./styles/stories-sphere-theme.css"), "stories-sphere-theme", 2, 300);
    await withRetry(() => import("./i18n"), "i18n", 2, 300);

    createRoot(rootEl).render(
      <HelmetProvider>
        <App />
      </HelmetProvider>,
    );

    void withRetry(() => probeBackend(SUPABASE_URL, SUPABASE_KEY), "backend-probe", 2, 500).catch((err) => {
      console.warn("[startup] backend probe unavailable; public shell remains active", err);
    });
  } catch (err) {
    console.error("[startup] failed to load app bundle", err);
    renderStartupError({
      kicker: "Load failed",
      title: "Couldn’t load the application",
      message: "One of the app modules failed to download after multiple attempts.",
      hint: "Retry to reload the application.",
    });
  }
})();
