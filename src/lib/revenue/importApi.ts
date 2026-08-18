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
import type { NormalizationResult } from "./normalize";
import type { RowMapping } from "./mapping";

export class DatabasePendingError extends Error {
  constructor(msg = "Revenue tables not available on this environment") {
    super(msg);
    this.name = "DatabasePendingError";
  }
}

export class StatementAlreadyImportedError extends Error {
  constructor(
    public readonly existingImportId: string,
    public readonly existingStatementKey: string | null = null,
  ) {
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
  const mappingByRowKey = new Map<string, RowMapping>();
  for (const m of input.mappings ?? []) {
    if (m?.rowKey) mappingByRowKey.set(m.rowKey, m);
  }

  const validRows = input.normalization.rows.filter((r) => r.errors.length === 0);
  const linesPayload = validRows.map((r) => {
    const mapping = mappingByRowKey.get(r.rowKey) ?? null;
    return {
      title_id: mapping?.titleId ?? null,
      deal_memo_id: mapping?.dealMemoId ?? null,
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
        source_row_key: r.rowKey,
        workspace_id: mapping?.workspaceId ?? input.workspaceId,
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
  });

  const payload = {
    statement_key: input.normalization.statementKey,
    source_type: input.sourceType,
    source_label: input.sourceLabel,
    source_statement_id: input.sourceStatementId,
    partner_id: input.partnerId,
    workspace_id: input.workspaceId,
    currency: input.currency,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    notes: input.notes,
    gross_amount_paise: input.normalization.totals.grossMinor,
    line_count: input.normalization.totals.rowCount,
    lines: linesPayload,
  };

  const { data, error } = await (supabase as any).rpc("import_revenue_statement", { p_payload: payload });

  if (error) {
    // Duplicate statement_key → 23505 with message "duplicate_statement:<uuid>"
    if (error.code === "23505" || /duplicate_statement/i.test(error.message ?? "")) {
      const m = /duplicate_statement:([0-9a-f-]+)/i.exec(error.message ?? "");
      const existingStatementKey =
        /(?:^|\s|,|;)sk=([^\s,;]+)/i.exec(error.message ?? "")?.[1] ??
        input.normalization.statementKey;
      throw new StatementAlreadyImportedError(m?.[1] ?? "", existingStatementKey);
    }
    // Missing RPC or relation → surface as pending
    if (error.code === "42883" || error.code === "42P01" || /function .* does not exist/i.test(error.message ?? "")) {
      throw new DatabasePendingError();
    }
    throw new Error(error.message ?? "Import failed");
  }

  const result = (data ?? {}) as { import_id?: string; inserted?: number };
  return {
    importId: result.import_id ?? "",
    inserted: result.inserted ?? linesPayload.length,
    skipped: input.normalization.totals.errorRowCount,
  };
}
