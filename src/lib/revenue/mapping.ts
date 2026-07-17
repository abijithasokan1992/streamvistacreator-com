/**
 * Admin mapping helpers — Phase D2B.
 *
 * Given normalized statement rows and a candidate list of titles, produce
 * a mapping proposal per row. Never guess by fuzzy title string alone; only
 * match when the title external reference is an exact case-insensitive
 * match. Ambiguous or missing matches → "hold_for_review" (never silently
 * mapped). The admin can override any per-row mapping and set batch
 * defaults (buyer, contract) before confirming the import.
 */

import type { NormalizedRevenueRow } from "./normalize";

export type MappingStatus = "mapped" | "hold_for_review" | "conflict";

export interface TitleCandidate {
  id: string;
  title: string;
  externalRefs?: string[]; // e.g. provider IDs, catalogue codes
  ownerUserId: string | null;
  workspaceId: string | null;
}

export interface DealCandidate {
  id: string;
  titleId: string | null;
  buyerUserId: string | null;
}

export interface MappingBatchDefaults {
  buyerUserId: string | null;
  dealMemoId: string | null;
  workspaceId: string | null;
}

export interface RowMapping {
  lineIndex: number;
  rowKey: string;
  titleId: string | null;
  buyerUserId: string | null;
  dealMemoId: string | null;
  workspaceId: string | null;
  status: MappingStatus;
  reasons: string[];
  candidates: string[];
}

export interface MappingResult {
  rows: RowMapping[];
  allMappedOrOnHold: boolean;
  unresolvedCount: number;
  holdCount: number;
  mappedCount: number;
}

function normRef(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export function proposeMappings(
  rows: NormalizedRevenueRow[],
  titles: TitleCandidate[],
  deals: DealCandidate[],
  defaults: MappingBatchDefaults,
  overrides: Record<string, Partial<RowMapping>> = {},
): MappingResult {
  const byRef = new Map<string, TitleCandidate[]>();
  for (const t of titles) {
    const refs = new Set<string>([normRef(t.title), ...(t.externalRefs ?? []).map(normRef)]);
    for (const r of refs) {
      if (!r) continue;
      const bucket = byRef.get(r) ?? [];
      bucket.push(t);
      byRef.set(r, bucket);
    }
  }

  const out: RowMapping[] = [];
  let hold = 0;
  let mapped = 0;

  for (const row of rows) {
    const override = overrides[row.rowKey];
    const ref = normRef(row.titleExternalRef);
    const matches = ref ? byRef.get(ref) ?? [] : [];
    const reasons: string[] = [];
    let titleId: string | null = override?.titleId ?? null;
    let status: MappingStatus = "hold_for_review";
    const candidateIds = matches.map((m) => m.id);

    if (!titleId) {
      if (!ref) {
        reasons.push("no_title_reference");
      } else if (matches.length === 0) {
        reasons.push("no_title_match");
      } else if (matches.length > 1) {
        reasons.push("ambiguous_title_match");
      } else {
        titleId = matches[0].id;
      }
    }

    // Explicit hold override always wins.
    if (override?.status === "hold_for_review") {
      status = "hold_for_review";
      reasons.push("admin_hold");
    } else if (titleId) {
      status = "mapped";
    }

    const buyerUserId = override?.buyerUserId ?? defaults.buyerUserId ?? null;
    const workspaceId = override?.workspaceId ?? defaults.workspaceId ?? null;

    let dealMemoId = override?.dealMemoId ?? defaults.dealMemoId ?? null;
    if (dealMemoId && titleId) {
      const d = deals.find((x) => x.id === dealMemoId);
      if (d && d.titleId && d.titleId !== titleId) {
        status = "conflict";
        reasons.push("deal_title_mismatch");
      }
    }

    // Row must be either mapped (with a titleId) or on hold — never silently
    // committed with a null title.
    if (status === "mapped" && !titleId) status = "hold_for_review";

    if (status === "mapped") mapped += 1;
    else hold += 1;

    out.push({
      lineIndex: row.lineIndex,
      rowKey: row.rowKey,
      titleId,
      buyerUserId,
      dealMemoId,
      workspaceId,
      status,
      reasons,
      candidates: candidateIds,
    });
  }

  return {
    rows: out,
    mappedCount: mapped,
    holdCount: hold,
    unresolvedCount: hold, // hold + conflict count against gating; conflict subset noted via reasons
    allMappedOrOnHold: out.every((r) => r.status === "mapped" || r.status === "hold_for_review"),
  };
}

/**
 * Confirm gate — must be true before the UI's "Confirm import" is enabled.
 * A row must be either explicitly mapped or explicitly held for review.
 * "conflict" rows block confirmation.
 */
export function canConfirmImport(result: MappingResult): boolean {
  return result.rows.every((r) => r.status === "mapped" || r.status === "hold_for_review");
}
