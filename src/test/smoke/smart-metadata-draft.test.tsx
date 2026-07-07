/**
 * End-to-end guard: Smart Metadata Import stays Draft.
 *
 * Verifies the invariant that the Creator workflow depends on:
 *   1. Search → pick → import invokes `onApply` with a metadata patch only.
 *   2. Nothing about status, submission, QC, legal, rights, licensing,
 *      commercial or pricing is ever included in that patch.
 *   3. No submit / QC / approval RPC is called anywhere in the flow.
 *   4. The whitelist (IMPORTABLE_FIELDS) excludes every protected surface.
 *
 * If any of these fail, an import could silently move a title past Draft
 * or overwrite creator-controlled business terms — both are release blockers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SmartMetadataImportButton } from "@/components/creator/title/SmartMetadataImport";
import {
  IMPORTABLE_FIELDS,
  type MetadataPreview,
  type MetadataSearchResult,
} from "@/lib/creator/metadataProviders";
import { emptyMetadata } from "@/lib/creator/titleSchema";

// --- Mocks -----------------------------------------------------------------

// Provider client: no network, deterministic search + preview payload.
vi.mock("@/lib/creator/metadataProviders", async (orig) => {
  const actual = await orig<typeof import("@/lib/creator/metadataProviders")>();
  const result: MetadataSearchResult = {
    provider: "tmdb",
    id: 12345,
    kind: "movie",
    title: "Test Film",
    original_title: "Test Film Original",
    year: 2024,
    overview: "A test film for the draft-invariant smoke test.",
    poster_url: "",
  };
  const preview: MetadataPreview = {
    title: "Test Film",
    original_title: "Test Film Original",
    synopsis: "A short synopsis from the provider.",
    genres: ["Drama"],
    runtime_minutes: 106,
    original_language: "en",
    country_of_origin: "US",
    production_year: 2024,
    release_date: "2024-08-01",
    production_company: "Test Studios",
    cast: [{ name: "Actor A", role: "Lead" }],
    crew: [{ name: "Director A", role: "Director" }],
    imdb_id: "tt0000000",
    tmdb_id: "12345",
    poster_url: "",
    trailer_url: "https://youtube.com/watch?v=abc",
    source: "tmdb",
  };
  return {
    ...actual,
    searchMetadata: vi.fn(async () => [result]),
    previewMetadata: vi.fn(async () => preview),
  };
});

// Spy on the Supabase client — nothing status-mutating should be called.
const rpcSpy = vi.fn();
const fromSpy = vi.fn();
const invokeSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    rpc: (...args: unknown[]) => {
      rpcSpy(...args);
      return Promise.resolve({ data: null, error: null });
    },
    from: (...args: unknown[]) => {
      fromSpy(...args);
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
    functions: { invoke: (...args: unknown[]) => { invokeSpy(...args); return Promise.resolve({ data: null, error: null }); } },
  },
}));

// Silence toast side-effects.
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// --- Suite -----------------------------------------------------------------

const PROTECTED_KEYS = [
  "status", "submitted_at", "approved_at", "published_at", "locked",
  "rights_owner", "rights", "licensing", "license", "territories",
  "exclusivity", "deal_model", "pricing", "price", "commercial",
  "legal", "qc", "review", "distribution",
];

beforeEach(() => {
  rpcSpy.mockClear();
  fromSpy.mockClear();
  invokeSpy.mockClear();
});
afterEach(() => cleanup());

describe("Smart Metadata Import — Draft invariant", () => {
  it("whitelist excludes every protected business field", () => {
    for (const k of PROTECTED_KEYS) {
      expect(IMPORTABLE_FIELDS as readonly string[]).not.toContain(k);
    }
  });

  it("import flow produces a Draft-only patch and never calls submit/QC/legal RPCs", async () => {
    const onApply = vi.fn();
    render(
      <SmartMetadataImportButton
        meta={emptyMetadata()}
        currentTitle=""
        onApply={onApply}
      />,
    );

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /Smart Metadata Import/i }));

    // Search
    const titleInput = await screen.findByPlaceholderText(/e\.g\. Dune/i);
    fireEvent.change(titleInput, { target: { value: "Test Film" } });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/i }));

    // Pick candidate
    const pickBtn = await screen.findByRole("button", { name: /Use this/i });
    fireEvent.click(pickBtn);

    // Import
    const importBtn = await screen.findByRole("button", { name: /Import selected/i });
    await waitFor(() => expect(importBtn).not.toBeDisabled());
    fireEvent.click(importBtn);

    // onApply must fire exactly once with a metadata patch only.
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const arg = onApply.mock.calls[0][0] as {
      title?: string;
      metadataPatch: Record<string, unknown>;
    };
    expect(arg).toHaveProperty("metadataPatch");
    expect(typeof arg.metadataPatch).toBe("object");

    // Every key in the patch must be an importable, whitelisted field.
    // `release_date` is imported as a metadata extension key alongside the whitelist.
    const allowed = new Set<string>([...IMPORTABLE_FIELDS, "release_date"]);
    for (const k of Object.keys(arg.metadataPatch)) {
      expect(allowed.has(k), `field '${k}' leaked into import patch`).toBe(true);
      expect(PROTECTED_KEYS).not.toContain(k);
    }

    // The patch NEVER carries status transitions or protected business fields.
    for (const k of PROTECTED_KEYS) {
      expect(arg.metadataPatch).not.toHaveProperty(k);
    }
    expect(arg).not.toHaveProperty("status");
    expect(arg).not.toHaveProperty("submitted_at");

    // No status-mutating RPC/table write occurred as a side effect of the import.
    const forbiddenRpcs = [
      "submit_title_to_admin",
      "approve_title",
      "publish_title",
      "advance_title_status",
      "complete_title_asset_upload",
    ];
    for (const call of rpcSpy.mock.calls) {
      expect(forbiddenRpcs).not.toContain(String(call[0]));
    }
    // The import dialog itself must not touch content_titles rows.
    for (const call of fromSpy.mock.calls) {
      expect(String(call[0])).not.toBe("content_titles");
      expect(String(call[0])).not.toBe("content_approvals");
    }
  });
});
