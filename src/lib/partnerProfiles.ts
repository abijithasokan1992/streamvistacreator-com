import { supabase } from "@/integrations/supabase/client";

export interface PartnerProfile {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  hero_image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  categories: string[];
  submission_requirements: string | null;
  licensing_models: string[];
  territories: string[];
  languages: string[];
  content_preferences: string[];
  runtime_min_minutes: number | null;
  runtime_max_minutes: number | null;
  min_resolution: string | null;
  audio_requirements: string | null;
  subtitle_requirements: string | null;
  exclusivity: string | null;
  revenue_share_notes: string | null;
  deal_timeline_days: number | null;
  contact_email: string | null;
}

export async function fetchPartnerProfiles(): Promise<PartnerProfile[]> {
  const { data, error } = await (supabase as any)
    .from("partner_profiles")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as PartnerProfile[];
}

export async function fetchPartnerProfile(slug: string): Promise<PartnerProfile | null> {
  const { data } = await (supabase as any)
    .from("partner_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (data as PartnerProfile) ?? null;
}
