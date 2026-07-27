/**
 * Thin persistence layer for revenue statement imports.
 *
 * Uses the EXISTING `revenue_imports` / `revenue_lines` tables. Extended
 * fields (tax, gateway fee, in-app fee, shares, model, statement idempotency
 * key, source_row_key) are stored inside the existing JSONB `metadata`
 * column until the pending migration lands.
 *
 * If the required tables/columns are absent, callers get a
 * `DatabasePendingError` so the UI can show "database update pending" instead
 * of writing partial data.
 */

import { supabase } from "@/integrations/supabase/client";
import type { NormalizationResult, NormalizedRevenueRow } from "./normalize";
import type { RowMapping } from "./mapping";

export class DatabasePendingError extends Error {
  constructor(msg = "Revenue tables not available on this environment") {
    super(msg);
    this.name = "DatabasePendingError";
  }
}

export class StatementAlreadyImportedError extends Error {
  constructor(public readonly existingImportId: string) {
    super("Statement already imported");
    this.name = "StatementAlreadyImportedError";
  }
}

export interface PersistStatementInput {
  sourceType: string;
  sourceLabel: string;
  sourceStatementId: string;
  partnerId: string | null;
  workspaceId: string | null;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
  normalization: NormalizationResult;
  /**
   * Admin-confirmed row-to-title mappings from the mapping step. When
   * provided, each persisted `revenue_lines` row inherits its `title_id`,
   * `partner_id`, and `metadata.workspace_id` from the mapping keyed by
   * `rowKey`. Rows with no mapping are still inserted (title_id=null) so
   * admins can complete the mapping later.
   */
  mappings?: RowMapping[];
}

export async function persistStatement(input: PersistStatementInput): Promise<{ importId: string; inserted: number; skipped: number }> {
  // Idempotency check by statementKey in metadata (best effort — the raw
  // metadata column may or may not be indexed yet).
  const { data: existing, error: probeErr } = await supabase
    .from("revenue_imports")
    .select("id, notes, source_type, source_label")
    .eq("source_type", input.sourceType)
    .eq("source_label", input.sourceLabel)
    .limit(1)
    .maybeSingle();

  if (probeErr && probeErr.code === "42P01") throw new DatabasePendingError();
  if (existing && (existing.notes ?? "").includes(input.normalization.statementKey)) {
    throw new StatementAlreadyImportedError(existing.id);
  }

  const { data: u } = await supabase.auth.getUser();
  const { data: imp, error: impErr } = await supabase
    .from("revenue_imports")
    .insert({
      source_type: input.sourceType,
      source_label: input.sourceLabel,
      partner_id: input.partnerId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      currency: input.currency,
      // statementKey stashed in notes for pre-migration idempotency probe
      notes: [`sk=${input.normalization.statementKey}`, input.notes ?? ""].filter(Boolean).join(" | "),
      imported_by: u.user?.id ?? null,
      gross_amount_paise: input.normalization.totals.grossMinor,
      line_count: input.normalization.totals.rowCount,
      status: "imported",
    })
    .select("id")
    .single();

  if (impErr) {
    if (impErr.code === "42P01") throw new DatabasePendingError();
    throw impErr;
  }

  const mappingByRowKey = new Map<string, RowMapping>();
  for (const m of input.mappings ?? []) {
    if (m?.rowKey) mappingByRowKey.set(m.rowKey, m);
  }

  const payload = input.normalization.rows
    .filter((r) => r.errors.length === 0)
    .map((r) => toRevenueLineRow(imp.id, r, input, mappingByRowKey.get(r.rowKey) ?? null));

  if (!payload.length) return { importId: imp.id, inserted: 0, skipped: input.normalization.rows.length };

  const { error: linesErr } = await supabase.from("revenue_lines").insert(payload);
  if (linesErr) {
    if (linesErr.code === "42P01") throw new DatabasePendingError();
    throw linesErr;
  }

  return { importId: imp.id, inserted: payload.length, skipped: input.normalization.totals.errorRowCount };
}

function toRevenueLineRow(
  importId: string,
  r: NormalizedRevenueRow,
  input: PersistStatementInput,
  mapping: RowMapping | null,
) {
  return {
    import_id: importId,
    title_id: mapping?.titleId ?? null,
    partner_id: input.partnerId,
    territory: r.territory,
    channel: r.channel,
    units: r.units,
    gross_amount_paise: r.grossMinor ?? 0,
    platform_fee_paise: (r.gatewayFeeMinor ?? 0) + (r.inAppFeeMinor ?? 0),
    net_amount_paise: r.netMinor ?? 0,
    currency: r.currency,
    occurred_on: r.occurredOn,
    metadata: {
      row_key: r.rowKey,
      statement_key: input.normalization.statementKey,
      source_type: input.sourceType,
      source_statement_id: input.sourceStatementId,
      workspace_id: mapping?.workspaceId ?? input.workspaceId,
      deal_memo_id: mapping?.dealMemoId ?? null,
      buyer_user_id: mapping?.buyerUserId ?? null,
      mapping_status: mapping?.status ?? "unmapped",
      title_external_ref: r.titleExternalRef,
      model: r.model,
      tax_paise: r.taxMinor,
      gateway_fee_paise: r.gatewayFeeMinor,
      in_app_fee_paise: r.inAppFeeMinor,
      share_rate: r.shareRate,
      creator_share_paise: r.creatorShareMinor,
      platform_share_paise: r.platformShareMinor,
      raw: r.raw,
      notes: r.notes,
    },
  };
}
