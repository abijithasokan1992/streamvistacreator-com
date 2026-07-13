import { supabase } from "@/integrations/supabase/client";

export type AiTriState = "yes" | "no" | "undecided";
export type AiRightsAuthorization = "yes" | "no" | "pending";
export type AiExclusivity = "exclusive" | "non_exclusive" | "unspecified";
export type AiReviewStatus =
  | "not_submitted"
  | "rights_review_required"
  | "technical_review_required"
  | "clarification_requested"
  | "eligible_for_matching"
  | "not_eligible"
  | "licensed"
  | "suspended";

export interface TitleAILicensing {
  id?: string;
  title_id: string;
  workspace_id: string;
  owner_user_id: string;
  available_for_review: AiTriState;
  rights_holder_authorized: AiRightsAuthorization;
  approved_use_cases: string[];
  prohibited_use_cases: string[];
  licence_term: string | null;
  territory: string | null;
  exclusivity: AiExclusivity;
  commercial_model: string | null;
  performer_consent_status: string | null;
  music_rights_status: string | null;
  source_master_available: boolean;
  resolution: string | null;
  frame_rate: string | null;
  lip_sync_qc_status: string | null;
  audio_languages: string[];
  subtitle_languages: string[];
  review_status: AiReviewStatus;
  submitted_at: string | null;
}

export const AI_REVIEW_STATUS_LABEL: Record<AiReviewStatus, string> = {
  not_submitted: "Not reviewed",
  rights_review_required: "Rights review required",
  technical_review_required: "Technical review required",
  clarification_requested: "Clarification requested",
  eligible_for_matching: "Eligible for matching",
  not_eligible: "Not eligible",
  licensed: "Licensed",
  suspended: "Suspended",
};

export async function fetchTitleAILicensing(titleId: string): Promise<TitleAILicensing | null> {
  const { data, error } = await supabase
    .from("title_ai_licensing")
    .select("*")
    .eq("title_id", titleId)
    .maybeSingle();
  if (error) throw error;
  return (data as TitleAILicensing | null) ?? null;
}

export async function upsertTitleAILicensing(
  row: Partial<TitleAILicensing> & { title_id: string; workspace_id: string; owner_user_id: string },
): Promise<TitleAILicensing> {
  const { data, error } = await supabase
    .from("title_ai_licensing")
    .upsert(row, { onConflict: "title_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as TitleAILicensing;
}
