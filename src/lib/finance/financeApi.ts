// Finance extension API. Reuses invoices, deal_payouts, revenue_transactions,
// partner_profiles, deal_memos, distribution_deliveries — no billing duplication.
import { supabase } from "@/integrations/supabase/client";
import { applyProductionFilterByTitleIdColumn } from "@/lib/operations/productionFilters";
import { fetchQuarantinedTitleIds } from "@/lib/operations/useQuarantinedTitleIds";

export type RevenueImport = {
  id: string;
  source_type: string;
  source_label: string | null;
  partner_id: string | null;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  gross_amount_paise: number;
  line_count: number;
  status: string;
  raw_file_url: string | null;
  notes: string | null;
  created_at: string;
};

export type RevenueLine = {
  id: string;
  import_id: string | null;
  title_id: string | null;
  deal_memo_id: string | null;
  distribution_delivery_id: string | null;
  partner_id: string | null;
  territory: string | null;
  channel: string | null;
  units: number | null;
  gross_amount_paise: number;
  platform_fee_paise: number;
  net_amount_paise: number;
  currency: string;
  occurred_on: string | null;
};

export type RoyaltyRule = {
  id: string;
  scope: "title" | "deal" | "partner" | "global";
  title_id: string | null;
  deal_memo_id: string | null;
  partner_id: string | null;
  beneficiary_type: string;
  beneficiary_user_id: string | null;
  beneficiary_label: string | null;
  share_pct: number;
  active: boolean;
  priority: number;
  notes: string | null;
};

export type RoyaltyRun = {
  id: string;
  run_label: string;
  period_start: string;
  period_end: string;
  status: string;
  gross_paise: number;
  allocated_paise: number;
  line_count: number;
  created_at: string;
};

export type RoyaltyAllocation = {
  id: string;
  run_id: string;
  title_id: string | null;
  deal_memo_id: string | null;
  beneficiary_type: string;
  beneficiary_user_id: string | null;
  beneficiary_label: string | null;
  gross_paise: number;
  share_pct: number | null;
  allocated_paise: number;
  currency: string;
  status: string;
};

export type PartnerStatement = {
  id: string;
  partner_id: string | null;
  beneficiary_user_id: string | null;
  statement_number: string | null;
  period_start: string;
  period_end: string;
  gross_paise: number;
  fees_paise: number;
  net_paise: number;
  status: string;
  issued_at: string | null;
};

export type Settlement = {
  id: string;
  settlement_number: string | null;
  beneficiary_type: string;
  beneficiary_user_id: string | null;
  beneficiary_label: string | null;
  partner_id: string | null;
  amount_paise: number;
  method: string | null;
  reference: string | null;
  status: string;
  scheduled_for: string | null;
  paid_at: string | null;
};

// ============================================================================
// Revenue Imports
// ============================================================================
export async function listRevenueImports(limit = 50): Promise<RevenueImport[]> {
  const { data, error } = await supabase
    .from("revenue_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RevenueImport[];
}

export async function createRevenueImport(input: Partial<RevenueImport>): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("revenue_imports")
    .insert({
      source_type: input.source_type ?? "manual",
      source_label: input.source_label ?? null,
      partner_id: input.partner_id ?? null,
      period_start: input.period_start ?? null,
      period_end: input.period_end ?? null,
      currency: input.currency ?? "INR",
      notes: input.notes ?? null,
      imported_by: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function addRevenueLines(
  importId: string,
  rows: Array<Partial<RevenueLine>>
): Promise<void> {
  if (!rows.length) return;
  const payload = rows.map((r) => ({
    import_id: importId,
    title_id: r.title_id ?? null,
    deal_memo_id: r.deal_memo_id ?? null,
    distribution_delivery_id: r.distribution_delivery_id ?? null,
    partner_id: r.partner_id ?? null,
    territory: r.territory ?? null,
    channel: r.channel ?? null,
    units: r.units ?? null,
    gross_amount_paise: r.gross_amount_paise ?? 0,
    platform_fee_paise: r.platform_fee_paise ?? 0,
    net_amount_paise:
      r.net_amount_paise ?? (r.gross_amount_paise ?? 0) - (r.platform_fee_paise ?? 0),
    currency: r.currency ?? "INR",
    occurred_on: r.occurred_on ?? null,
  }));
  const { error } = await supabase.from("revenue_lines").insert(payload);
  if (error) throw error;

  // Update rollup
  const gross = payload.reduce((s, r) => s + Number(r.gross_amount_paise ?? 0), 0);
  await supabase
    .from("revenue_imports")
    .update({
      gross_amount_paise: gross,
      line_count: payload.length,
      status: "imported",
    })
    .eq("id", importId);
}

export async function listRevenueLines(filter?: {
  importId?: string;
  titleId?: string;
  limit?: number;
}): Promise<RevenueLine[]> {
  let q = supabase.from("revenue_lines").select("*").order("occurred_on", { ascending: false });
  if (filter?.importId) q = q.eq("import_id", filter.importId);
  if (filter?.titleId) q = q.eq("title_id", filter.titleId);
  q = q.limit(filter?.limit ?? 200);
  const quarantined = await fetchQuarantinedTitleIds();
  const filtered = applyProductionFilterByTitleIdColumn(q, quarantined, "title_id");
  const { data, error } = await filtered;
  if (error) throw error;
  return (data ?? []) as RevenueLine[];
}

// ============================================================================
// Royalty Rules & Runs
// ============================================================================
export async function listRoyaltyRules(): Promise<RoyaltyRule[]> {
  const { data, error } = await supabase
    .from("royalty_rules")
    .select("*")
    .order("priority", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as RoyaltyRule[];
}

export async function upsertRoyaltyRule(rule: Partial<RoyaltyRule>): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (rule.id) {
    const { error } = await supabase.from("royalty_rules").update(rule as any).eq("id", rule.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("royalty_rules").insert({
      scope: rule.scope ?? "title",
      title_id: rule.title_id ?? null,
      deal_memo_id: rule.deal_memo_id ?? null,
      partner_id: rule.partner_id ?? null,
      beneficiary_type: rule.beneficiary_type ?? "creator",
      beneficiary_user_id: rule.beneficiary_user_id ?? null,
      beneficiary_label: rule.beneficiary_label ?? null,
      share_pct: rule.share_pct ?? 0,
      priority: rule.priority ?? 100,
      active: rule.active ?? true,
      notes: rule.notes ?? null,
      created_by: u.user?.id ?? null,
    });
    if (error) throw error;
  }
}

export async function deleteRoyaltyRule(id: string): Promise<void> {
  const { error } = await supabase.from("royalty_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function listRoyaltyRuns(): Promise<RoyaltyRun[]> {
  const { data, error } = await supabase
    .from("royalty_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as RoyaltyRun[];
}

export async function createRoyaltyRun(input: {
  run_label: string;
  period_start: string;
  period_end: string;
}): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("royalty_runs")
    .insert({ ...input, created_by: u.user?.id ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function computeRoyaltyRun(runId: string): Promise<any> {
  const { data, error } = await supabase.rpc("compute_royalty_run", { _run_id: runId });
  if (error) throw error;
  return data;
}

export async function approveRoyaltyRun(runId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("royalty_runs")
    .update({ status: "approved", approved_by: u.user?.id ?? null, approved_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw error;
  await supabase.from("royalty_allocations").update({ status: "approved" }).eq("run_id", runId).eq("status", "draft");
}

export async function listAllocationsForRun(runId: string): Promise<RoyaltyAllocation[]> {
  const { data, error } = await supabase
    .from("royalty_allocations")
    .select("*")
    .eq("run_id", runId)
    .order("allocated_paise", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as RoyaltyAllocation[];
}

// ============================================================================
// Partner Statements
// ============================================================================
export async function listPartnerStatements(): Promise<PartnerStatement[]> {
  const { data, error } = await supabase
    .from("partner_statements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PartnerStatement[];
}

export async function generatePartnerStatement(input: {
  partner_id?: string | null;
  beneficiary_user_id?: string | null;
  period_start: string;
  period_end: string;
}): Promise<string> {
  // Aggregate revenue_lines for the partner in the given period.
  let q = supabase
    .from("revenue_lines")
    .select("id,gross_amount_paise,platform_fee_paise,net_amount_paise,title_id,channel,territory,occurred_on")
    .gte("occurred_on", input.period_start)
    .lte("occurred_on", input.period_end);
  if (input.partner_id) q = q.eq("partner_id", input.partner_id);
  const { data: lines, error } = await q;
  if (error) throw error;

  const gross = (lines ?? []).reduce((s, r: any) => s + Number(r.gross_amount_paise ?? 0), 0);
  const fees = (lines ?? []).reduce((s, r: any) => s + Number(r.platform_fee_paise ?? 0), 0);
  const net = (lines ?? []).reduce((s, r: any) => s + Number(r.net_amount_paise ?? 0), 0);

  const stmtNum = `STMT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data: u } = await supabase.auth.getUser();

  const { data, error: insErr } = await supabase
    .from("partner_statements")
    .insert({
      partner_id: input.partner_id ?? null,
      beneficiary_user_id: input.beneficiary_user_id ?? null,
      statement_number: stmtNum,
      period_start: input.period_start,
      period_end: input.period_end,
      gross_paise: gross,
      fees_paise: fees,
      net_paise: net,
      status: "issued",
      issued_at: new Date().toISOString(),
      line_snapshot: (lines ?? []) as any,
      created_by: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return data.id;
}

// ============================================================================
// Settlements
// ============================================================================
export async function listSettlements(): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from("settlements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Settlement[];
}

export async function createSettlement(input: Partial<Settlement> & { amount_paise: number; beneficiary_type: string }): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const stmtNum = `STL-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("settlements")
    .insert({
      settlement_number: stmtNum,
      beneficiary_type: input.beneficiary_type,
      beneficiary_user_id: input.beneficiary_user_id ?? null,
      beneficiary_label: input.beneficiary_label ?? null,
      partner_id: input.partner_id ?? null,
      statement_id: (input as any).statement_id ?? null,
      amount_paise: input.amount_paise,
      method: input.method ?? "bank_transfer",
      reference: input.reference ?? null,
      status: input.status ?? "pending",
      scheduled_for: input.scheduled_for ?? null,
      notes: (input as any).notes ?? null,
      created_by: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function markSettlementPaid(id: string, reference?: string): Promise<void> {
  const { error } = await supabase
    .from("settlements")
    .update({ status: "paid", paid_at: new Date().toISOString(), reference: reference ?? undefined })
    .eq("id", id);
  if (error) throw error;
}

// ============================================================================
// Revenue Dashboard summary
// ============================================================================
export async function getRevenueSummary(days = 90): Promise<{
  total_gross_paise: number;
  total_net_paise: number;
  by_channel: Array<{ channel: string; gross_paise: number; net_paise: number }>;
  by_month: Array<{ month: string; gross_paise: number; net_paise: number }>;
  outstanding_payouts_paise: number;
  paid_payouts_paise: number;
}> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const [{ data: lines }, { data: payouts }] = await Promise.all([
    supabase
      .from("revenue_lines")
      .select("channel,gross_amount_paise,net_amount_paise,occurred_on")
      .gte("occurred_on", since),
    supabase.from("deal_payouts").select("payout_amount_paise,status"),
  ]);

  const rows = (lines ?? []) as any[];
  const total_gross_paise = rows.reduce((s, r) => s + Number(r.gross_amount_paise ?? 0), 0);
  const total_net_paise = rows.reduce((s, r) => s + Number(r.net_amount_paise ?? 0), 0);

  const chMap = new Map<string, { gross_paise: number; net_paise: number }>();
  for (const r of rows) {
    const k = r.channel ?? "other";
    const cur = chMap.get(k) ?? { gross_paise: 0, net_paise: 0 };
    cur.gross_paise += Number(r.gross_amount_paise ?? 0);
    cur.net_paise += Number(r.net_amount_paise ?? 0);
    chMap.set(k, cur);
  }

  const monthMap = new Map<string, { gross_paise: number; net_paise: number }>();
  for (const r of rows) {
    if (!r.occurred_on) continue;
    const m = String(r.occurred_on).slice(0, 7);
    const cur = monthMap.get(m) ?? { gross_paise: 0, net_paise: 0 };
    cur.gross_paise += Number(r.gross_amount_paise ?? 0);
    cur.net_paise += Number(r.net_amount_paise ?? 0);
    monthMap.set(m, cur);
  }

  const po = (payouts ?? []) as any[];
  const outstanding_payouts_paise = po
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + Number(r.payout_amount_paise ?? 0), 0);
  const paid_payouts_paise = po
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + Number(r.payout_amount_paise ?? 0), 0);

  return {
    total_gross_paise,
    total_net_paise,
    by_channel: [...chMap.entries()]
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.gross_paise - a.gross_paise),
    by_month: [...monthMap.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    outstanding_payouts_paise,
    paid_payouts_paise,
  };
}

export const fmtINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format((paise || 0) / 100);
