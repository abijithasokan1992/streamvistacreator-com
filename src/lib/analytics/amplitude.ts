const AMPLITUDE_SCRIPT_ID = "streamvista-amplitude-browser-sdk";
const AMPLITUDE_SCRIPT_SRC = "https://cdn.amplitude.com/libs/analytics-browser-2.45.5-min.js.gz";
const AMPLITUDE_SCRIPT_INTEGRITY = "sha384-lUDMpxCLYsnroVQqNbtcMW8an6gKOeYD+lp8pILILRV5HggRTJEm0A1BokY4ErgJ";

export const STREAMVISTA_LIFECYCLE_EVENT_CHAIN = [
  "Creator Acquired",
  "Content Submitted",
  "Rights Completed",
  "QC Passed",
  "Buyer Ready",
  "Buyer Interest",
  "Deal Created",
  "Contract Executed",
  "Delivery Completed",
  "Revenue Recorded",
  "Settlement Completed",
] as const;

export type StreamVistaLifecycleEvent = (typeof STREAMVISTA_LIFECYCLE_EVENT_CHAIN)[number];

type AnalyticsValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsValue | null | undefined>;

type AmplitudeBrowser = {
  init: (apiKey: string, userId?: string, options?: Record<string, unknown>) => unknown;
  track: (eventName: string, properties?: Record<string, AnalyticsValue>) => unknown;
};

declare global {
  interface Window {
    amplitude?: AmplitudeBrowser;
  }
}

const ALLOWED_PROPERTY_KEYS = new Set([
  "persona",
  "content_id",
  "content_type",
  "source",
  "campaign",
  "territory",
  "buyer_id",
  "company_id",
  "deal_id",
  "rights_status",
  "qc_status",
  "deal_value",
  "currency",
  "revenue_type",
  "authenticated",
  "path",
  "submission_mode",
  "contract_status",
  "delivery_status",
  "settlement_status",
]);

let initializationPromise: Promise<AmplitudeBrowser | null> | null = null;

export function sanitizeAnalyticsProperties(properties: AnalyticsProperties): Record<string, AnalyticsValue> {
  const sanitized: Record<string, AnalyticsValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    sanitized[key] = value;
  }

  return sanitized;
}

function loadAmplitudeScript(): Promise<AmplitudeBrowser | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(null);
  if (window.amplitude) return Promise.resolve(window.amplitude);

  return new Promise((resolve) => {
    const existing = document.getElementById(AMPLITUDE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.amplitude ?? null), { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = AMPLITUDE_SCRIPT_ID;
    script.src = AMPLITUDE_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.integrity = AMPLITUDE_SCRIPT_INTEGRITY;
    script.referrerPolicy = "no-referrer";
    script.addEventListener("load", () => resolve(window.amplitude ?? null), { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
  });
}

async function getAmplitude(): Promise<AmplitudeBrowser | null> {
  const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY?.trim();
  if (!apiKey) return null;

  if (!initializationPromise) {
    initializationPromise = loadAmplitudeScript().then((client) => {
      if (!client) return null;

      client.init(apiKey, undefined, {
        // StreamVista uses precision business events only. This prevents page/form
        // autocapture from becoming a second noisy analytics truth or collecting
        // unnecessary user-entered form context.
        autocapture: false,
        fetchRemoteConfig: false,
      });

      return client;
    });
  }

  return initializationPromise;
}

export async function trackLifecycleEvent(
  eventName: StreamVistaLifecycleEvent,
  properties: AnalyticsProperties = {},
): Promise<void> {
  try {
    const client = await getAmplitude();
    if (!client) return;
    client.track(eventName, sanitizeAnalyticsProperties(properties));
  } catch (error) {
    // Analytics must never block the commercial workflow.
    console.warn("[analytics:amplitude] lifecycle event failed", eventName, error);
  }
}
