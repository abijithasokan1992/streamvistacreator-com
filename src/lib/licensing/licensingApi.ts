import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OfferRound = Database["public"]["Tables"]["offer_rounds"]["Row"];
export type LicenseContract = Database["public"]["Tables"]["license_contracts"]["Row"];
export type LicenseEvent = Database["public"]["Tables"]["license_events"]["Row"];

/** ---------- Offer & Negotiation ---------- */
export async function listOfferRounds(commercialRequestId: string) {
  const { data, error } = await supabase
    .from("offer_rounds")
    .select("*")
    .eq("commercial_request_id", commercialRequestId)
    .order("round_no", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OfferRound[];
}

export async function addOfferRound(input: {
  commercial_request_id: string;
  party: "buyer" | "admin" | "owner";
  actor_user_id: string;
  message?: string;
  amount_paise?: number | null;
  currency?: string;
  terms?: Record<string, unknown>;
  status?: OfferRound["status"];
}) {
  // Determine next round_no
  const { data: last } = await supabase
    .from("offer_rounds")
    .select("round_no")
    .eq("commercial_request_id", input.commercial_request_id)
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const round_no = (last?.round_no ?? 0) + 1;

  const { data, error } = await supabase
    .from("offer_rounds")
    .insert({
      commercial_request_id: input.commercial_request_id,
      round_no,
      party: input.party,
      actor_user_id: input.actor_user_id,
      terms: (input.terms ?? {}) as never,
      message: input.message ?? null,
      amount_paise: input.amount_paise ?? null,
      currency: input.currency ?? "INR",
      status: input.status ?? "proposed",
    })
    .select()
    .single();
  if (error) throw error;
  return data as OfferRound;
}

/** ---------- License Contracts ---------- */
export async function listContracts(dealMemoId: string) {
  const { data, error } = await supabase
    .from("license_contracts")
    .select("*")
    .eq("deal_memo_id", dealMemoId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LicenseContract[];
}

export async function createContract(input: {
  deal_memo_id: string;
  title_id?: string | null;
  document_url?: string | null;
  legal_text?: string | null;
  created_by: string;
}) {
  const { data: last } = await supabase
    .from("license_contracts")
    .select("version")
    .eq("deal_memo_id", input.deal_memo_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (last?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("license_contracts")
    .insert({
      deal_memo_id: input.deal_memo_id,
      title_id: input.title_id ?? null,
      document_url: input.document_url ?? null,
      legal_text: input.legal_text ?? null,
      created_by: input.created_by,
      version,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return data as LicenseContract;
}

export async function updateContractStatus(
  id: string,
  patch: Partial<Pick<LicenseContract, "status" | "buyer_signed_at" | "buyer_signer_name" | "owner_signed_at" | "owner_signer_name" | "countersigned_at" | "countersigned_by" | "document_url" | "document_sha256">>,
) {
  const { data, error } = await supabase
    .from("license_contracts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LicenseContract;
}

/** ---------- License Lifecycle Events ---------- */
export async function listLicenseEvents(dealMemoId: string) {
  const { data, error } = await supabase
    .from("license_events")
    .select("*")
    .eq("deal_memo_id", dealMemoId)
    .order("event_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LicenseEvent[];
}

export async function addLicenseEvent(input: {
  deal_memo_id: string;
  event_type: LicenseEvent["event_type"];
  actor_user_id?: string | null;
  notes?: string | null;
  payload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("license_events")
    .insert({
      deal_memo_id: input.deal_memo_id,
      event_type: input.event_type,
      actor_user_id: input.actor_user_id ?? null,
      notes: input.notes ?? null,
      payload: (input.payload ?? {}) as never,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LicenseEvent;
}

/** ---------- Rights Matrix (reads existing title_rights_availability) ---------- */
export type RightsMatrixRow = Database["public"]["Tables"]["title_rights_availability"]["Row"];

export async function getRightsMatrix(titleId: string) {
  const { data, error } = await supabase
    .from("title_rights_availability")
    .select("*")
    .eq("title_id", titleId)
    .order("right_category", { ascending: true })
    .order("territory", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RightsMatrixRow[];
}
