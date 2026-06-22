import { supabase } from "@/integrations/supabase/client";

export type AgreementType =
  | "creator_master"
  | "buyer_request_confidentiality"
  | "free_tier_commercial"
  | "screener_access"
  | "antipiracy_addendum";

export type LegalAgreement = {
  id: string;
  agreement_type: AgreementType;
  version: number;
  title: string;
  body: string;
  summary: string | null;
  published_at: string | null;
};

/** Fetch the currently-published version for a given agreement type. */
export async function fetchCurrentAgreement(type: AgreementType): Promise<LegalAgreement | null> {
  const { data, error } = await supabase
    .from("legal_agreements")
    .select("id,agreement_type,version,title,body,summary,published_at")
    .eq("agreement_type", type)
    .eq("is_current", true)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as LegalAgreement) ?? null;
}

/** Has the current user accepted the current version of this agreement? */
export async function hasAcceptedCurrent(type: AgreementType): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const agreement = await fetchCurrentAgreement(type);
  if (!agreement) return false;
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", user.id)
    .eq("agreement_id", agreement.id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Record acceptance of a specific agreement version for the current user. */
export async function recordAcceptance(
  agreement: LegalAgreement,
  context: Record<string, unknown> = {},
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase.from("legal_acceptances").insert({
    user_id: user.id,
    agreement_id: agreement.id,
    agreement_type: agreement.agreement_type,
    version: agreement.version,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    context,
  });
  if (error && !/duplicate key/i.test(error.message)) throw error;
}
