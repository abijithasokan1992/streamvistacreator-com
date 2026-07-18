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
}

export async function persistStatement(input: PersistStatementInput): Promise<{ importId: string; inserted: number; skipped: number }> {
  // Exact indexed idempotency check. We intentionally require the pending
  // typed-column migration: importing against the legacy shape would weaken
  // duplicate protection and workspace isolation.
  const { data: existing, error: probeErr } = await (supabase as any)
    .from("revenue_imports")
    .select("id")
    .eq("statement_key", input.normalization.statementKey)
    .maybeSingle();

  if (probeErr?.code === "42P01" || probeErr?.code === "42703") {
    throw new DatabasePendingError();
  }
  if (probeErr) throw probeErr;
  if (existing?.id) throw new StatementAlreadyImportedError(existing.id);

  const { data: u } = await supabase.auth.getUser();
  const { data: imp, error: impErr } = await (supabase as any)
    .from("revenue_imports")
    .insert({
      workspace_id: input.workspaceId,
      source_type: input.sourceType,
      source_label: input.sourceLabel,
      source_statement_id: input.sourceStatementId,
      statement_key: input.normalization.statementKey,
      partner_id: input.partnerId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      currency: input.currency,
      notes: input.notes,
      imported_by: u.user?.id ?? null,
      gross_amount_paise: input.normalization.totals.grossMinor,
      tax_paise: input.normalization.totals.taxMinor,
      gateway_fee_paise: input.normalization.totals.gatewayFeeMinor,
      in_app_fee_paise: input.normalization.totals.inAppFeeMinor,
      net_amount_paise: input.normalization.totals.netMinor,
      line_count: input.normalization.totals.rowCount,
      mapping_status: "unmapped",
      status: "imported",
    })
    .select("id")
    .single();

  if (impErr) {
    if (impErr.code === "42P01" || impErr.code === "42703") throw new DatabasePendingError();
    throw impErr;
  }

  const payload = input.normalization.rows
    .filter((r) => r.errors.length === 0)
    .map((r) => toRevenueLineRow(imp.id, r, input));

  if (!payload.length) return { importId: imp.id, inserted: 0, skipped: input.normalization.rows.length };

  const { error: linesErr } = await (supabase as any).from("revenue_lines").insert(payload);
  if (linesErr) {
    if (linesErr.code === "42P01" || linesErr.code === "42703") throw new DatabasePendingError();
    throw linesErr;
  }

  return { importId: imp.id, inserted: payload.length, skipped: input.normalization.totals.errorRowCount };
}

function toRevenueLineRow(importId: string, r: NormalizedRevenueRow, input: PersistStatementInput) {
  return {
    import_id: importId,
    workspace_id: input.workspaceId,
    row_key: r.rowKey,
    statement_key: input.normalization.statementKey,
    source_row_index: r.lineIndex,
    source_statement_id: input.sourceStatementId,
    commercial_model: r.model,
    title_id: null, // mapping stage will patch this after admin confirms the buyer/title
    partner_id: input.partnerId,
    territory: r.territory,
    channel: r.channel,
    units: r.units,
    gross_amount_paise: r.grossMinor ?? 0,
    platform_fee_paise: (r.gatewayFeeMinor ?? 0) + (r.inAppFeeMinor ?? 0),
    tax_paise: r.taxMinor ?? 0,
    gateway_fee_paise: r.gatewayFeeMinor ?? 0,
    in_app_fee_paise: r.inAppFeeMinor ?? 0,
    creator_share_paise: r.creatorShareMinor,
    platform_share_paise: r.platformShareMinor,
    share_rate: r.shareRate,
    raw_row: r.raw,
    mapping_status: "unmapped",
    net_amount_paise: r.netMinor ?? 0,
    currency: r.currency,
    occurred_on: r.occurredOn,
    metadata: {
      row_key: r.rowKey,
      statement_key: input.normalization.statementKey,
      source_type: input.sourceType,
      source_statement_id: input.sourceStatementId,
      workspace_id: input.workspaceId,
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
