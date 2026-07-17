// Duplicate-creation prevention for createTitle().
//
// Verifies that when the same clientDraftId is supplied twice (e.g. retry
// or rapid double-click), we return the existing row instead of inserting
// a second one.

import { describe, it, expect, vi, beforeEach } from "vitest";

const state: { rows: Array<Record<string, any>> } = { rows: [] };

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    let query: any = { table, filters: {} as Record<string, unknown> };
    const api: any = {
      select: () => api,
      eq: (col: string, val: unknown) => { query.filters[col] = val; return api; },
      maybeSingle: async () => {
        const found = state.rows.find(
          (r) => Object.entries(query.filters).every(([k, v]) => r[k] === v),
        );
        return { data: found ?? null, error: null };
      },
      single: async () => {
        const found = state.rows.find(
          (r) => Object.entries(query.filters).every(([k, v]) => r[k] === v),
        );
        return { data: found ?? null, error: null };
      },
      insert: (payload: Record<string, unknown>) => {
        const row = { id: `t_${state.rows.length + 1}`, ...payload };
        state.rows.push(row);
        query.filters = { id: row.id };
        return api;
      },
      update: () => api,
    };
    return api;
  };
  return {
    supabase: {
      from: (t: string) => chain(t),
      auth: { getUser: async () => ({ data: { user: null } }) },
    },
  };
});

import { createTitle } from "@/lib/creator/titleApi";

describe("createTitle idempotency", () => {
  beforeEach(() => { state.rows = []; });

  it("returns the same row when called twice with the same clientDraftId", async () => {
    const first = await createTitle("owner-1", null, "My Film", "feature_film", "draft-abc");
    const second = await createTitle("owner-1", null, "My Film", "feature_film", "draft-abc");
    expect(first.id).toBe(second.id);
    expect(state.rows.length).toBe(1);
  });

  it("creates distinct rows for distinct clientDraftIds", async () => {
    const a = await createTitle("owner-1", null, "A", "feature_film", "draft-a");
    const b = await createTitle("owner-1", null, "B", "feature_film", "draft-b");
    expect(a.id).not.toBe(b.id);
    expect(state.rows.length).toBe(2);
  });
});
