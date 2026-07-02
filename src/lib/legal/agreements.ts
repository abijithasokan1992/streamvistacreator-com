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

/** Has the current user accepted the current published version of this agreement? */
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
    .eq("version", agreement.version)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Record acceptance via the controlled server RPC. The server resolves the
 * current published version and the calling user id; the client cannot
 * insert directly into legal_acceptances.
 */
export async function recordAcceptance(
  agreement: LegalAgreement,
  context: Record<string, unknown> = {},
): Promise<void> {
  const ctx: Record<string, unknown> = {
    ...context,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    accepted_via: "web_modal",
  };
  const { error } = await supabase.rpc("accept_legal_agreement", {
    p_agreement_type: agreement.agreement_type,
    p_context: ctx as never,
  });
  if (error) throw error;
}
