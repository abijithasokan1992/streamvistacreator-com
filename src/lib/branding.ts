import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LogoPosition = "top-left" | "top-right";
export type FooterPosition = "footer-left" | "footer-right";

export interface BrandingSettings {
  id: string;
  site_logo_url: string | null;
  site_logo_position: LogoPosition;
  footer_logo_url: string | null;
  footer_logo_position: FooterPosition;
  show_wordmark: boolean;
  allow_user_logos: boolean;
  user_logos_paid_only: boolean;
}

let cached: BrandingSettings | null = null;
let inflight: Promise<BrandingSettings | null> | null = null;

export async function fetchBranding(force = false): Promise<BrandingSettings | null> {
  if (cached && !force) return cached;
  if (inflight) return inflight;
  inflight = supabase
    .from("branding_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
    .then(({ data }) => {
      cached = (data as BrandingSettings | null) ?? null;
      inflight = null;
      return cached;
    });
  return inflight;
}

export function useBranding() {
  const [b, setB] = useState<BrandingSettings | null>(cached);
  useEffect(() => {
    let live = true;
    fetchBranding().then((v) => { if (live) setB(v); });
    const channel = supabase
      .channel("branding-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "branding_settings" }, () => {
        fetchBranding(true).then((v) => { if (live) setB(v); });
      })
      .subscribe();
    return () => { live = false; supabase.removeChannel(channel); };
  }, []);
  return b;
}

// Upload to private "branding" bucket and return a long-lived signed URL
export async function uploadBrandingFile(file: File, path: string): Promise<string> {
  const { error } = await supabase.storage.from("branding").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("branding")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // ~5 years
  if (sErr || !data?.signedUrl) throw sErr ?? new Error("Could not sign URL");
  return data.signedUrl;
}
