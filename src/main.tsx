import { createRoot } from "react-dom/client";

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
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0f;color:#f5f5f7;font-family:Inter,system-ui,sans-serif;padding:24px;">
      <div style="max-width:560px;border:1px solid #2a2a33;border-radius:12px;padding:28px;background:#12121a;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#f5a524;margin-bottom:12px;">${kicker}</div>
        <h1 style="font-size:22px;margin:0 0 12px;font-weight:600;">${title}</h1>
        <p style="margin:0 0 16px;color:#c7c7d1;line-height:1.55;">${message}</p>
        ${hint ? `<p style="margin:0 0 20px;color:#8a8a95;font-size:13px;line-height:1.55;">${hint}</p>` : ""}
        ${showReload ? `<button id="__sv_reload" style="appearance:none;border:1px solid #2a2a33;background:#1c1c26;color:#f5f5f7;padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer;">Retry now</button>` : ""}
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

void (async () => {
  try {
    const [{ default: App }, { HelmetProvider }] = await withRetry(
      () => Promise.all([import("./App.tsx"), import("react-helmet-async")]),
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
