import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the supabase client used by the hook.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { useMarketplaceCatalog } from "@/components/buyer/marketplace/useMarketplaceCatalog";

const baseRow = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Sample Title",
  synopsis: null as string | null,
  language: "en",
  genre: "drama",
  duration_minutes: 100,
  kind: "film",
  metadata_year: 2024,
  commercial_status: "licensing_open",
  screener_available: true,
  licensing_nonexclusive_available: true,
  licensing_exclusive_available: false,
  acquisition_available: false,
  distribution_partnership_available: false,
  buyer_facing_summary: null as string | null,
  poster_url: null as string | null,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useMarketplaceCatalog", () => {
  beforeEach(() => rpc.mockReset());

  it("calls only the approved buyer_list_marketplace_titles RPC", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("buyer_list_marketplace_titles");
  });

  it("normalizes RPC rows into MarketplaceTitle shape", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ ...baseRow, buyer_facing_summary: "Blurb wins" }],
      error: null,
    });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    const row = result.current.rows[0];
    expect(row.id).toBe(baseRow.id);
    expect(row.title).toBe("Sample Title");
    expect(row.content_type).toBe("film");
    expect(row.year).toBe(2024);
    expect(row.updated_at).toBe("2026-01-01T00:00:00Z");
  });

  it("returns an empty catalog when the RPC returns no rows", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces RPC errors and clears rows", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("denied");
    expect(result.current.rows).toEqual([]);
  });

  it("prefers buyer_facing_summary over synopsis for the blurb", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        ...baseRow,
        buyer_facing_summary: "Curated blurb",
        synopsis: "A very long synopsis that should be ignored when a summary exists",
      }],
      error: null,
    });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].blurb).toBe("Curated blurb");
  });

  it("falls back to a 240-char truncation of synopsis when no summary is provided", async () => {
    const longSynopsis = "x".repeat(500);
    rpc.mockResolvedValueOnce({
      data: [{ ...baseRow, buyer_facing_summary: null, synopsis: longSynopsis }],
      error: null,
    });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const blurb = result.current.rows[0].blurb ?? "";
    expect(blurb.length).toBe(240);
    expect(blurb).toBe("x".repeat(240));
  });

  it("nulls out legacy fields with no source of truth (subtitle, partner, dates)", async () => {
    rpc.mockResolvedValueOnce({ data: [baseRow], error: null });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const row = result.current.rows[0];
    expect(row.subtitle).toBeNull();
    expect(row.partner).toBeNull();
    expect(row.starts_at).toBeNull();
    expect(row.ends_at).toBeNull();
  });

  it("preserves nullable poster_url from the RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { ...baseRow, id: "00000000-0000-0000-0000-000000000010", poster_url: null },
        { ...baseRow, id: "00000000-0000-0000-0000-000000000011", poster_url: "https://cdn/example.jpg" },
      ],
      error: null,
    });
    const { result } = renderHook(() => useMarketplaceCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].poster_url).toBeNull();
    expect(result.current.rows[1].poster_url).toBe("https://cdn/example.jpg");
  });
});
