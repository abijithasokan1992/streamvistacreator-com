import { describe, it, expect } from "vitest";
import { syncCanonicalAndMetadata, hasMinimalDraftFields } from "@/lib/creator/titleNormalization";

// Simulates the read-side enrichment done in titleApi.getTitle: a persisted
// row has canonical columns filled but metadata JSON is blank. After
// enrichment the wizard should see the values and mark the Details step
// complete on reopen.
function enrich(row: {
  title: string; synopsis: string | null; language: string | null; genre: string | null;
  duration_minutes: number | null; metadata: any;
}) {
  const { metadata } = syncCanonicalAndMetadata(
    {
      canonical: {
        title: row.title, synopsis: row.synopsis, language: row.language,
        genre: row.genre, duration_minutes: row.duration_minutes,
      },
      metadata: row.metadata ?? {},
    },
    { metadata: row.metadata ?? {} },
  );
  return { ...row, metadata: { ...(row.metadata ?? {}), ...metadata } };
}

// Mirror of the wizard's Details-tab completion predicate from TitleEditor.
function detailsComplete(row: ReturnType<typeof enrich>): boolean {
  const m = row.metadata;
  return (
    !!row.title?.trim() &&
    !!m.synopsis?.trim() &&
    (m.genres?.length ?? 0) > 0 &&
    !!m.original_language?.trim() &&
    (m.runtime_minutes ?? 0) > 0
  );
}

describe("editor resume: persisted canonical values count as complete", () => {
  it("hydrates blank metadata JSON from canonical columns on reopen", () => {
    const persisted = {
      title: "My Film",
      synopsis: "Long-form synopsis here.",
      language: "Malayalam",
      genre: "Drama",
      duration_minutes: 120,
      metadata: {}, // legacy row: only canonical columns are populated
    };
    const enriched = enrich(persisted);
    expect(enriched.metadata.synopsis).toBe("Long-form synopsis here.");
    expect(enriched.metadata.original_language).toBe("Malayalam");
    expect(enriched.metadata.genres).toEqual(["Drama"]);
    expect(enriched.metadata.runtime_minutes).toBe(120);
    expect(detailsComplete(enriched)).toBe(true);
  });

  it("keeps metadata values when canonical is blank", () => {
    const persisted = {
      title: "Only-Metadata Film",
      synopsis: null,
      language: null,
      genre: null,
      duration_minutes: null,
      metadata: {
        synopsis: "From metadata.",
        original_language: "English",
        genres: ["Thriller"],
        runtime_minutes: 95,
      },
    };
    const enriched = enrich(persisted);
    expect(detailsComplete(enriched)).toBe(true);
  });

  it("does NOT mark a fresh empty draft as complete", () => {
    const fresh = {
      title: "Untitled",
      synopsis: null, language: null, genre: null, duration_minutes: null,
      metadata: {},
    };
    expect(detailsComplete(enrich(fresh))).toBe(false);
  });

  it("does not resurrect a runtime of 0 from either side", () => {
    const persisted = {
      title: "Zero-Runtime",
      synopsis: "s", language: "English", genre: "Drama",
      duration_minutes: 0,
      metadata: { runtime_minutes: 0 },
    };
    expect(detailsComplete(enrich(persisted))).toBe(false);
  });
});

describe("autosave minimal-fields gate", () => {
  it("permits autosave with just a title", () => {
    expect(hasMinimalDraftFields({ canonical: { title: "Draft" } as any })).toBe(true);
  });
  it("blocks autosave with no title", () => {
    expect(hasMinimalDraftFields({ canonical: {} as any })).toBe(false);
    expect(hasMinimalDraftFields({ canonical: { title: "   " } as any })).toBe(false);
  });
});
