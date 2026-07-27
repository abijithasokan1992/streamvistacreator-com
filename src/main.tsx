import { createRoot } from "react-dom/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const rootEl = document.getElementById("root")!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Startup guard: render a clear configuration error instead of a black screen
  // caused by `createClient` throwing "supabaseUrl is required" during module init.
  const missing = [
    !SUPABASE_URL && "VITE_SUPABASE_URL",
    !SUPABASE_KEY && "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]
    .filter(Boolean)
    .join(", ");

  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0f;color:#f5f5f7;font-family:Inter,system-ui,sans-serif;padding:24px;">
      <div style="max-width:560px;border:1px solid #2a2a33;border-radius:12px;padding:28px;background:#12121a;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#f5a524;margin-bottom:12px;">Configuration error</div>
        <h1 style="font-size:22px;margin:0 0 12px;font-weight:600;">Backend environment is not configured</h1>
        <p style="margin:0 0 16px;color:#c7c7d1;line-height:1.55;">
          The app cannot start because required environment variables are missing:
          <code style="color:#ffb4b4;">${missing}</code>.
        </p>
        <p style="margin:0;color:#8a8a95;font-size:13px;line-height:1.55;">
          In Lovable, reconnect Lovable Cloud (or verify the project&rsquo;s <code>.env</code>)
          so these variables are injected at build time, then reload the preview.
        </p>
      </div>
    </div>`;
  // eslint-disable-next-line no-console
  console.error(`[startup] Missing Supabase env vars: ${missing}`);
} else {
  void (async () => {
    const [{ default: App }, { HelmetProvider }] = await Promise.all([
      import("./App.tsx"),
      import("react-helmet-async"),
    ]);
    await import("./index.css");
    await import("./i18n");
    createRoot(rootEl).render(
      <HelmetProvider>
        <App />
      </HelmetProvider>,
    );
  })();
}
