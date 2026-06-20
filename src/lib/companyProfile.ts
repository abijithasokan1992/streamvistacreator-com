import { supabase } from "@/integrations/supabase/client";

export interface BrandUnit {
  key: string;
  title: string;
  one_liner: string;
  description: string;
  link?: string;
}

export interface CompanyProfileVisibility {
  hero: boolean;
  founder: boolean;
  brands: boolean;
  works: boolean;
  thesis: boolean;
}

export interface CompanyProfile {
  id: string;
  parent_company_name: string;
  parent_company_description: string;
  ecosystem_thesis: string;
  founder_name: string;
  founder_role_line: string;
  founder_bio: string;
  founder_image_url: string | null;
  founder_image_alt: string | null;
  brands: BrandUnit[];
  visibility: CompanyProfileVisibility;
}

export interface FounderWork {
  id: string;
  title: string;
  role: string | null;
  year: string | null;
  synopsis: string | null;
  achievement: string | null;
  banner: string | null;
  sort_order: number;
  visible: boolean;
}

export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  const { data } = await (supabase as any)
    .from("company_profile")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as CompanyProfile) ?? null;
}

export async function fetchFounderWorks(onlyVisible = true): Promise<FounderWork[]> {
  let q = (supabase as any).from("founder_works").select("*").order("sort_order", { ascending: true });
  if (onlyVisible) q = q.eq("visible", true);
  const { data } = await q;
  return (data ?? []) as FounderWork[];
}

export async function uploadFounderImage(file: File): Promise<string> {
  const path = `founder/founder-${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("branding")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data?.signedUrl) throw sErr ?? new Error("Could not sign URL");
  return data.signedUrl;
}
