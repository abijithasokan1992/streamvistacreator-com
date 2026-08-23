/**
 * Canonical AI Media Services analytics adapter.
 *
 * Truthful by design: if no analytics provider is configured (no Amplitude
 * API key in this app), events are recorded to the project activity trail in
 * the database only — nothing is fabricated and no external ingestion is
 * claimed. Never pass PII, payment secrets, media or rights documents here.
 */
import { supabase } from "@/integrations/supabase/client";

export type ServiceAnalyticsEvent =
  | "service_page_viewed"
  | "service_selected"
  | "project_started"
  | "project_submitted"
  | "quote_requested"
  | "payment_started"
  | "payment_completed"
  | "production_started"
  | "human_qc_completed"
  | "delivery_completed";

export interface ServiceAnalyticsProps {
  service_type?: string | null;
  project_id?: string | null;
  creator_type?: string | null;
  source?: string | null;
}

const AMPLITUDE_KEY = (import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined)?.trim();

/** Truthful provider state for operator/debug surfaces. */
export function analyticsProviderStatus(): { provider: string; configured: boolean; note: string } {
  if (AMPLITUDE_KEY) {
    return { provider: "amplitude", configured: true, note: "Amplitude key present." };
  }
  return {
    provider: "none",
    configured: false,
    note: "No external analytics provider configured. Events are stored in the StreamVista project activity trail only.",
  };
}

const ALLOWED_KEYS: (keyof ServiceAnalyticsProps)[] = [
  "service_type",
  "project_id",
  "creator_type",
  "source",
];

function sanitize(props: ServiceAnalyticsProps): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

/**
 * Track a canonical service event. Never throws — analytics must not break
 * a commercial flow.
 */
export async function trackServiceEvent(
  event: ServiceAnalyticsEvent,
  props: ServiceAnalyticsProps = {},
): Promise<void> {
  const metadata = sanitize(props);

  if (AMPLITUDE_KEY && typeof window !== "undefined") {
    const amplitude = (window as unknown as {
      amplitude?: { track?: (e: string, p?: Record<string, string>) => void };
    }).amplitude;
    try {
      amplitude?.track?.(event, metadata);
    } catch {
      /* provider failures never break the flow */
    }
  }

  // Durable, first-party trail (RLS-scoped). Only written when we have a project.
  if (!metadata.project_id) return;
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const actorId = userRes?.user?.id;
    if (!actorId) return;
    await (supabase as unknown as {
      from: (t: string) => {
        insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
    })
      .from("sv_service_project_events")
      .insert({
        project_id: metadata.project_id,
        event_type: event,
        actor_id: actorId,
        metadata,
      });
  } catch {
    /* never surface analytics failures to the user */
  }
}
