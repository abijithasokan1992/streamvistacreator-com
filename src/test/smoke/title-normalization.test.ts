import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeTitle,
  normalizeSynopsis,
  normalizeLanguage,
  normalizeGenres,
  normalizeDurationMinutes,
  primaryGenre,
  syncCanonicalAndMetadata,
  hasMinimalDraftFields,
} from "@/lib/creator/titleNormalization";
import { getOrCreateDraftId, clearDraftId } from "@/lib/creator/draftIdempotency";

describe("titleNormalization", () => {
  describe("primitive normalizers", () => {
    it("treats blank/whitespace/null/zero as absent", () => {
      expect(normalizeTitle("   ")).toBeNull();
      expect(normalizeTitle(null)).toBeNull();
      expect(normalizeSynopsis("\n\n  ")).toBeNull();
      expect(normalizeLanguage("")).toBeNull();
      expect(normalizeDurationMinutes(0)).toBeNull();
      expect(normalizeDurationMinutes("0")).toBeNull();
      expect(normalizeDurationMinutes(-5)).toBeNull();
      expect(normalizeGenres("")).toEqual([]);
      expect(normalizeGenres(null)).toEqual([]);
    });

    it("title-cases languages and dedupes/cases genres", () => {
      expect(normalizeLanguage("english")).toBe("English");
      expect(normalizeLanguage("  MALAYALAM  ")).toBe("Malayalam");
      expect(normalizeGenres(["drama", "Drama", "  action  "])).toEqual(["Drama", "Action"]);
      expect(normalizeGenres("drama|thriller,drama")).toEqual(["Drama", "Thriller"]);
      expect(primaryGenre(["  ", "Comedy"])).toBe("Comedy");
    });

    it("clamps durations to sane integers", () => {
      expect(normalizeDurationMinutes(96.7)).toBe(97);
      expect(normalizeDurationMinutes("125")).toBe(125);
      expect(normalizeDurationMinutes(9999999)).toBeNull();
    });
  });

  describe("syncCanonicalAndMetadata", () => {
    it("fills canonical fields from metadata when canonical is blank", () => {
      const { canonical, metadata, conflicts } = syncCanonicalAndMetadata(null, {
        metadata: {
          synopsis: "A quiet film.",
          original_language: "malayalam",
          genres: ["drama", "thriller"],
          runtime_minutes: 118,
        } as any,
        canonical: { title: "Nomad" },
      });
      expect(canonical.title).toBe("Nomad");
      expect(canonical.synopsis).toBe("A quiet film.");
      expect(canonical.language).toBe("Malayalam");
      expect(canonical.genre).toBe("Drama");
      expect(canonical.duration_minutes).toBe(118);
      expect(metadata.genres).toEqual(["Drama", "Thriller"]);
      expect(metadata.original_language).toBe("Malayalam");
      expect(metadata.runtime_minutes).toBe(118);
      expect(conflicts).toEqual([]);
    });

    it("does not overwrite valid canonical values with blank patch values", () => {
      const { canonical } = syncCanonicalAndMetadata(
        {
          canonical: { title: "Existing", language: "Tamil", duration_minutes: 120, synopsis: "Old" },
          metadata: { original_language: "Tamil", runtime_minutes: 120 } as any,
        },
        {
          canonical: { title: "Existing", language: "", duration_minutes: 0, synopsis: "" },
          metadata: { original_language: "", runtime_minutes: 0 } as any,
        },
      );
      expect(canonical.language).toBe("Tamil");
      expect(canonical.duration_minutes).toBe(120);
      expect(canonical.synopsis).toBe("Old");
    });

    it("reports language conflict without silently merging", () => {
      const { conflicts, canonical } = syncCanonicalAndMetadata(null, {
        canonical: { title: "T", language: "Hindi" },
        metadata: { original_language: "Tamil" } as any,
      });
      expect(canonical.language).toBe("Hindi"); // canonical wins
      expect(conflicts.some((c) => c.field === "language")).toBe(true);
    });

    it("reports duration conflict when both sides supply distinct valid values", () => {
      const { conflicts } = syncCanonicalAndMetadata(null, {
        canonical: { title: "T", duration_minutes: 100 },
        metadata: { runtime_minutes: 110 } as any,
      });
      expect(conflicts.some((c) => c.field === "duration_minutes")).toBe(true);
    });
  });

  describe("hasMinimalDraftFields", () => {
    it("accepts a title alone as sufficient for autosave", () => {
      expect(hasMinimalDraftFields({ canonical: { title: "Untitled" } })).toBe(true);
      expect(hasMinimalDraftFields({ canonical: { title: "  " } })).toBe(false);
      expect(hasMinimalDraftFields({})).toBe(false);
    });
  });
});

describe("draftIdempotency", () => {
  beforeEach(() => {
    try { globalThis.localStorage?.clear(); } catch { /* noop */ }
  });

  it("returns a stable id across calls for the same owner+slot", () => {
    const a = getOrCreateDraftId("owner-1", "new-title");
    const b = getOrCreateDraftId("owner-1", "new-title");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{8,}$/i);
  });

  it("isolates ids by owner and by slot", () => {
    const a = getOrCreateDraftId("owner-1", "new-title");
    const b = getOrCreateDraftId("owner-2", "new-title");
    const c = getOrCreateDraftId("owner-1", "import:tmdb:1");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("clearDraftId forces a new id on next call", () => {
    const a = getOrCreateDraftId("owner-1", "slot");
    clearDraftId("owner-1", "slot");
    const b = getOrCreateDraftId("owner-1", "slot");
    expect(a).not.toBe(b);
  });
});
