/**
 * Expected-vs-actual reconciliation helpers — pure, no side effects.
 *
 * Supports the three commercial models that carry a reconciliation surface
 * in D2B: fixed license fee, MG (minimum guarantee, recoupable), and pure
 * revenue share. No accounting entries, no payouts, no state mutations.
 *
 * All amounts are integer paise/minor units.
 */

import type { CommercialModel } from "./commercialModels";

export interface ReconciliationInput {
  model: CommercialModel;
  /** Contracted expected amount (e.g. fixed fee or MG floor). */
  expectedMinor?: number | null;
  /** Sum of net revenue from imported statement lines. */
  actualNetMinor: number;
  /** Rate (0..1) for revenue-share and MG-tail calculations. */
  shareRate?: number | null;
  /** For MG: total previously recouped in prior periods. */
  priorRecoupedMinor?: number | null;
}

export interface ReconciliationResult {
  model: CommercialModel;
  expectedMinor: number | null;
  actualNetMinor: number;
  recognizedMinor: number;
  recoupedMinor: number;
  remainingMinor: number;
  varianceMinor: number;
  creatorShareMinor: number;
  platformShareMinor: number;
  status: "on_track" | "surplus" | "shortfall" | "recouped" | "recouping" | "n/a";
  notes: string[];
}

export function reconcile(input: ReconciliationInput): ReconciliationResult {
  const notes: string[] = [];
  const expected = input.expectedMinor ?? null;
  const actual = input.actualNetMinor;
  const rate = clampRate(input.shareRate);

  if (input.model === "fixed_license_fee") {
    return reconcileFixed(expected, actual, notes);
  }
  if (input.model === "mg") {
    return reconcileMg(expected, actual, rate, input.priorRecoupedMinor ?? 0, notes);
  }
  if (input.model === "revenue_share") {
    return reconcileRevShare(actual, rate, notes);
  }
  // Other models: return a neutral result — reconciliation not modelled here.
  return {
    model: input.model,
    expectedMinor: expected,
    actualNetMinor: actual,
    recognizedMinor: actual,
    recoupedMinor: 0,
    remainingMinor: 0,
    varianceMinor: expected === null ? 0 : actual - expected,
    creatorShareMinor: 0,
    platformShareMinor: 0,
    status: "n/a",
    notes: ["reconciliation not modelled for this commercial model"],
  };
}

function clampRate(r: number | null | undefined): number {
  if (r === null || r === undefined || !Number.isFinite(r)) return 0;
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}

function reconcileFixed(expected: number | null, actual: number, notes: string[]): ReconciliationResult {
  if (expected === null) notes.push("expected_missing");
  const variance = expected === null ? 0 : actual - expected;
  const status: ReconciliationResult["status"] =
    expected === null ? "n/a" : variance === 0 ? "on_track" : variance > 0 ? "surplus" : "shortfall";
  return {
    model: "fixed_license_fee",
    expectedMinor: expected,
    actualNetMinor: actual,
    recognizedMinor: expected ?? actual,
    recoupedMinor: 0,
    remainingMinor: 0,
    varianceMinor: variance,
    // Fixed fees don't compute a share here — that is deal-scoped.
    creatorShareMinor: 0,
    platformShareMinor: 0,
    status,
    notes,
  };
}

function reconcileMg(
  mg: number | null,
  actualNet: number,
  rate: number,
  priorRecouped: number,
  notes: string[],
): ReconciliationResult {
  if (mg === null) {
    notes.push("mg_missing");
    return {
      model: "mg",
      expectedMinor: null,
      actualNetMinor: actualNet,
      recognizedMinor: actualNet,
      recoupedMinor: 0,
      remainingMinor: 0,
      varianceMinor: 0,
      creatorShareMinor: 0,
      platformShareMinor: 0,
      status: "n/a",
      notes,
    };
  }
  const priorClamped = Math.max(0, Math.min(priorRecouped, mg));
  const outstanding = Math.max(0, mg - priorClamped);
  // Creator share of gross-net funds this recoupment first.
  const shareOfActual = Math.round(actualNet * rate);
  const recoupedThisPeriod = Math.min(outstanding, shareOfActual);
  const remaining = outstanding - recoupedThisPeriod;
  // After recoupment, creator earns the balance of their share as an
  // overage; platform keeps the rest of the net.
  const creatorOverage = Math.max(0, shareOfActual - recoupedThisPeriod);
  const platformShare = Math.max(0, actualNet - shareOfActual);
  const status: ReconciliationResult["status"] = remaining === 0 ? "recouped" : "recouping";
  return {
    model: "mg",
    expectedMinor: mg,
    actualNetMinor: actualNet,
    recognizedMinor: shareOfActual,
    recoupedMinor: recoupedThisPeriod,
    remainingMinor: remaining,
    varianceMinor: shareOfActual - outstanding,
    creatorShareMinor: creatorOverage,
    platformShareMinor: platformShare,
    status,
    notes,
  };
}

function reconcileRevShare(actualNet: number, rate: number, notes: string[]): ReconciliationResult {
  const creator = Math.round(actualNet * rate);
  const platform = actualNet - creator;
  return {
    model: "revenue_share",
    expectedMinor: null,
    actualNetMinor: actualNet,
    recognizedMinor: actualNet,
    recoupedMinor: 0,
    remainingMinor: 0,
    varianceMinor: 0,
    creatorShareMinor: creator,
    platformShareMinor: platform,
    status: "on_track",
    notes,
  };
}
