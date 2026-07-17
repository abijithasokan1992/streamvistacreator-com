/**
 * Statement row normalization layer. Pure — no DB, no side effects.
 *
 * Adapters translate provider-specific CSV rows into a canonical
 * NormalizedRevenueRow. BookMyShow is the first adapter; others plug in
 * through the ADAPTER_REGISTRY.
 */

import { parseAmountToMinor, parseRate } from "./money";
import { rowIdempotencyKey, statementIdempotencyKey } from "./idempotency";
import type { CommercialModel } from "./commercialModels";
import { isCommercialModel } from "./commercialModels";

export interface NormalizedRevenueRow {
  lineIndex: number;
  titleExternalRef: string | null;
  occurredOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  model: CommercialModel | null;
  channel: string | null;
  territory: string | null;
  units: number | null;
  grossMinor: number | null;
  taxMinor: number | null;
  gatewayFeeMinor: number | null;
  inAppFeeMinor: number | null;
  netMinor: number | null;
  shareRate: number | null;
  creatorShareMinor: number | null;
  platformShareMinor: number | null;
  notes: string | null;
  rowKey: string;
  raw: Record<string, unknown>;
  errors: string[];
}

export interface StatementContext {
  sourceType: string;
  sourceStatementId: string;
  partnerId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
  defaultShareRate?: number | null;
  defaultModel?: CommercialModel | null;
}

export interface NormalizationResult {
  statementKey: string;
  rows: NormalizedRevenueRow[];
  totals: {
    grossMinor: number;
    taxMinor: number;
    gatewayFeeMinor: number;
    inAppFeeMinor: number;
    netMinor: number;
    creatorShareMinor: number;
    platformShareMinor: number;
    errorRowCount: number;
    rowCount: number;
  };
}

export type Adapter = (
  raw: Record<string, unknown>,
  ctx: StatementContext,
  index: number,
) => Partial<NormalizedRevenueRow>;

// ---------- Generic normalizer ------------------------------------------

function normISODate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Accept yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function normalizeStatement(
  rows: Array<Record<string, unknown>>,
  ctx: StatementContext,
  adapter: Adapter,
): NormalizationResult {
  const statementKey = statementIdempotencyKey({
    sourceType: ctx.sourceType,
    sourceStatementId: ctx.sourceStatementId,
    partnerId: ctx.partnerId ?? null,
    periodStart: ctx.periodStart ?? null,
    periodEnd: ctx.periodEnd ?? null,
    currency: ctx.currency ?? "INR",
  });

  const seenRowKeys = new Set<string>();
  const out: NormalizedRevenueRow[] = [];
  const totals = {
    grossMinor: 0,
    taxMinor: 0,
    gatewayFeeMinor: 0,
    inAppFeeMinor: 0,
    netMinor: 0,
    creatorShareMinor: 0,
    platformShareMinor: 0,
    errorRowCount: 0,
    rowCount: 0,
  };

  rows.forEach((raw, idx) => {
    const partial = adapter(raw, ctx, idx);
    const errors: string[] = [];

    const gross = partial.grossMinor ?? null;
    if (gross === null) errors.push("gross_amount_invalid");
    const tax = partial.taxMinor ?? 0;
    const gateway = partial.gatewayFeeMinor ?? 0;
    const inApp = partial.inAppFeeMinor ?? 0;
    let net = partial.netMinor;
    if (net === null || net === undefined) {
      net = gross === null ? null : gross - tax - gateway - inApp;
    }

    const shareRate =
      partial.shareRate ?? (ctx.defaultShareRate ?? null);
    let creatorShare = partial.creatorShareMinor ?? null;
    let platformShare = partial.platformShareMinor ?? null;
    if (creatorShare === null && net !== null && shareRate !== null) {
      creatorShare = Math.round(net * shareRate);
      platformShare = net - creatorShare;
    }

    const model = partial.model && isCommercialModel(partial.model) ? partial.model : ctx.defaultModel ?? null;

    const rowKey = rowIdempotencyKey({
      statementKey,
      titleExternalRef: partial.titleExternalRef ?? null,
      occurredOn: partial.occurredOn ?? null,
      channel: partial.channel ?? null,
      territory: partial.territory ?? null,
      units: partial.units ?? null,
      grossAmountMinor: gross,
      lineIndex: idx,
    });
    if (seenRowKeys.has(rowKey)) {
      errors.push("duplicate_row_in_statement");
    } else {
      seenRowKeys.add(rowKey);
    }

    const row: NormalizedRevenueRow = {
      lineIndex: idx,
      titleExternalRef: partial.titleExternalRef ?? null,
      occurredOn: partial.occurredOn ?? null,
      periodStart: partial.periodStart ?? ctx.periodStart ?? null,
      periodEnd: partial.periodEnd ?? ctx.periodEnd ?? null,
      currency: (partial.currency ?? ctx.currency ?? "INR").toUpperCase(),
      model,
      channel: partial.channel ?? null,
      territory: partial.territory ?? null,
      units: partial.units ?? null,
      grossMinor: gross,
      taxMinor: tax,
      gatewayFeeMinor: gateway,
      inAppFeeMinor: inApp,
      netMinor: net,
      shareRate,
      creatorShareMinor: creatorShare,
      platformShareMinor: platformShare,
      notes: partial.notes ?? null,
      rowKey,
      raw,
      errors: [...(partial.errors ?? []), ...errors],
    };

    if (row.errors.length) totals.errorRowCount += 1;
    totals.rowCount += 1;
    totals.grossMinor += row.grossMinor ?? 0;
    totals.taxMinor += row.taxMinor ?? 0;
    totals.gatewayFeeMinor += row.gatewayFeeMinor ?? 0;
    totals.inAppFeeMinor += row.inAppFeeMinor ?? 0;
    totals.netMinor += row.netMinor ?? 0;
    totals.creatorShareMinor += row.creatorShareMinor ?? 0;
    totals.platformShareMinor += row.platformShareMinor ?? 0;

    out.push(row);
  });

  return { statementKey, rows: out, totals };
}

// ---------- BookMyShow adapter ------------------------------------------

/** Case-insensitive field lookup. Adapter aliases the many labels providers use. */
function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    for (const rk of Object.keys(raw)) {
      if (rk.toLowerCase().trim() === k.toLowerCase()) return raw[rk];
    }
  }
  return undefined;
}

export const bookMyShowAdapter: Adapter = (raw, _ctx, _idx) => {
  const titleRef = pick(raw, ["title_id", "content_id", "title", "movie", "movie_name"]);
  const occurred = normISODate(pick(raw, ["date", "txn_date", "transaction_date"]));
  const territory = pick(raw, ["territory", "region", "city", "state"]);
  const channel = pick(raw, ["channel", "platform", "source"]);
  const model = pick(raw, ["model", "commercial_model"]);
  const units = Number(pick(raw, ["units", "tickets", "quantity", "qty"]) ?? NaN);
  const currency = pick(raw, ["currency", "curr"]);

  const gross = parseAmountToMinor(pick(raw, ["gross", "gross_amount", "gross_collection"]));
  const tax = parseAmountToMinor(pick(raw, ["gst", "tax", "tax_amount"])) ?? 0;
  const gateway = parseAmountToMinor(pick(raw, ["gateway_fee", "pg_fee", "payment_gateway_charge"])) ?? 0;
  const inApp = parseAmountToMinor(pick(raw, ["in_app_fee", "convenience_fee", "platform_fee"])) ?? 0;
  const net = parseAmountToMinor(pick(raw, ["net", "net_amount", "payout"]));
  const shareRate = parseRate(pick(raw, ["share_rate", "revenue_share", "rev_share_pct"]));
  const creatorShare = parseAmountToMinor(pick(raw, ["creator_share", "producer_share"]));
  const platformShare = parseAmountToMinor(pick(raw, ["platform_share", "buyer_share"]));
  const notes = pick(raw, ["notes", "remarks"]);

  return {
    titleExternalRef: titleRef ? String(titleRef).trim() : null,
    occurredOn: occurred,
    channel: channel ? String(channel).trim() : "bookmyshow",
    territory: territory ? String(territory).trim() : null,
    units: Number.isFinite(units) ? Math.trunc(units) : null,
    currency: currency ? String(currency).trim().toUpperCase() : undefined,
    model: model ? String(model).trim().toLowerCase() as CommercialModel : undefined,
    grossMinor: gross,
    taxMinor: tax,
    gatewayFeeMinor: gateway,
    inAppFeeMinor: inApp,
    netMinor: net,
    shareRate,
    creatorShareMinor: creatorShare,
    platformShareMinor: platformShare,
    notes: notes ? String(notes) : null,
  };
};

export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  bookmyshow: bookMyShowAdapter,
};

export function getAdapter(sourceType: string): Adapter | null {
  return ADAPTER_REGISTRY[sourceType.toLowerCase()] ?? null;
}
