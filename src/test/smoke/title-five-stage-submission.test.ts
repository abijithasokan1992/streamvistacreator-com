/**
 * Focused regression suite for the consolidated five-stage submission flow.
 *
 * Covers:
 *  - Exactly five canonical stages in the required order
 *  - Basics preserves title/kind/language/runtime
 *  - Story requires synopsis, genre and director
 *  - Rights & Business requires owner, territory and commercial model
 *  - Assets stage requires a master upload; poster/trailer/subs/legal optional
 *  - Review stage requires accepted terms
 *  - Harshiv fixture: "Bahumukham – Good, Bad & The Actor" Telugu / 87 min
 *    resumes without re-prompting for valid basics fields
 *  - Idempotent client_draft_id for repeated resumes (no duplicate creation)
 *
 * ZERO AI. No network. No production data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUBMISSION_STEPS,
  computeProgress,
  pickNextAction,
  validateStep,
  getStep,
} from "@/lib/submission";
import { syncCanonicalAndMetadata } from "@/lib/creator/titleNormalization";
import { getOrCreateDraftId, clearDraftId } from "@/lib/creator/draftIdempotency";

describe("five-stage title submission — structure", () => {
  it("has exactly 5 stages in canonical order", () => {
    expect(SUBMISSION_STEPS.map((s) => s.id)).toEqual([
      "basics",
      "story",
      "rights_business",
      "assets",
      "review",
    ]);
  });

  it("presents plain-language fallback labels for every stage", () => {
    expect(SUBMISSION_STEPS.map((s) => s.fallbackLabel)).toEqual([
      "Basics",
      "Story",
      "Rights & Business",
      "Assets",
      "Review & Submit",
    ]);
  });
});

describe("Creator editor — canonical stage wiring", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/components/creator/title/TitleEditor.tsx"),
    "utf8",
  );

  it("renders and advances Rights & Business before Assets", () => {
    expect(src).toMatch(
      /label: "Story"[\s\S]*label: "Rights & Business"[\s\S]*label: "Assets"[\s\S]*label: "Review & Submit"/,
    );
    expect(src).toContain(
      'const tabOrder: TabId[] = ["overview", "metadata", "rights", "assets", "submission"]',
    );
  });

  it("unlocks Rights after Story and Assets only after Rights", () => {
    expect(src).toMatch(/rights:[\s\S]{0,100}unlocked: bypass \|\| metadataComplete/);
    expect(src).toMatch(/assets:[\s\S]{0,120}metadataComplete && rightsComplete/);
  });
});

describe("Basics stage — essential fields only", () => {
  it("requires title, kind, language and runtime", () => {
    const step = getStep("basics")!;
    const missing = validateStep({}, step).missing.map((m) => m.key);
    expect(missing).toEqual(
      expect.arrayContaining(["title", "kind", "language", "duration_minutes"]),
    );
  });

  it("accepts a valid Basics payload", () => {
    const step = getStep("basics")!;
    const r = validateStep(
      { title: "X", kind: "film", language: "te", duration_minutes: 87 },
      step,
    );
    expect(r.complete).toBe(true);
  });
});

describe("Story stage — synopsis, genre and director", () => {
  it("requires synopsis (≥80 chars), genre and director", () => {
    const step = getStep("story")!;
    const short = validateStep({ synopsis: "too short" }, step);
    expect(short.complete).toBe(false);
    const keys = short.missing.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(["synopsis", "genre", "crew.director"]));
  });
});

describe("Rights & Business stage — preserves commercial taxonomy", () => {
  it("requires owner, territory, and commercial model", () => {
    const step = getStep("rights_business")!;
    const missing = validateStep({}, step).missing.map((m) => m.key);
    expect(missing).toEqual(
      expect.arrayContaining([
        "rights.owner_name",
        "rights.territory",
        "rights.commercial_model",
      ]),
    );
  });

  it.each(["SVOD", "TVOD", "AVOD", "MG", "fixed", "revenue_share", "per_film", "bulk_titles", "bulk_hours"] as const)(
    "accepts commercial model %s from the canonical taxonomy",
    (model) => {
      const step = getStep("rights_business")!;
      const r = validateStep(
        {
          rights: {
            owner_name: "Studio X",
            territory: "IN",
            commercial_model: model,
          },
        },
        step,
      );
      expect(r.complete).toBe(true);
    },
  );
});

describe("Assets stage — master required, others optional", () => {
  it("marks stage complete with just the master uploaded", () => {
    const step = getStep("assets")!;
    const r = validateStep({ assets: { master_uploaded: true } }, step);
    expect(r.complete).toBe(true);
  });

  it("fails without a master upload", () => {
    const step = getStep("assets")!;
    expect(validateStep({}, step).complete).toBe(false);
  });
});

describe("Review & Submit — final gate", () => {
  it("requires accepted_terms", () => {
    const step = getStep("review")!;
    expect(validateStep({}, step).complete).toBe(false);
    expect(validateStep({ legal: { accepted_terms: true } }, step).complete).toBe(true);
  });
});

describe("progress + next-action across five stages", () => {
  const fullPayload = {
    title: "Bahumukham – Good, Bad & The Actor",
    kind: "film",
    language: "Telugu",
    duration_minutes: 87,
    synopsis: "x".repeat(120),
    genre: "Drama",
    crew: { director: "H. Kumar" },
    rights: {
      owner_name: "Independent",
      territory: "IN",
      commercial_model: "revenue_share",
    },
    assets: { master_uploaded: true },
    legal: { accepted_terms: true },
  };

  it("reports 100% when every stage is satisfied", () => {
    expect(computeProgress(fullPayload).percent).toBe(100);
  });

  it("routes to the first incomplete stage deterministically", () => {
    const partial = { ...fullPayload, rights: {} };
    const next = pickNextAction(partial);
    expect(next.stepId).toBe("rights_business");
    expect(next.submissionReady).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Harshiv regression fixture — the reference title used to validate resume
// behavior end-to-end. Data below is a synthetic in-memory row; NOTHING is
// inserted or mutated in the database.
// -----------------------------------------------------------------------------
const HARSHIV_PERSISTED_ROW = {
  title: "Bahumukham – Good, Bad & The Actor",
  synopsis: null as string | null,
  language: "Telugu",
  genre: "Drama",
  duration_minutes: 87,
  metadata: {} as Record<string, unknown>,
};

function enrichForResume(row: typeof HARSHIV_PERSISTED_ROW) {
  const { metadata } = syncCanonicalAndMetadata(
    {
      canonical: {
        title: row.title,
        synopsis: row.synopsis,
        language: row.language,
        genre: row.genre,
        duration_minutes: row.duration_minutes,
      },
      metadata: row.metadata,
    },
    { metadata: row.metadata },
  );
  return { ...row, metadata: { ...row.metadata, ...metadata } };
}

describe("Harshiv fixture: Bahumukham resumes without re-prompting valid Basics", () => {
  it("hydrates canonical Basics fields onto metadata on reopen", () => {
    const enriched = enrichForResume(HARSHIV_PERSISTED_ROW);
    // Canonical ↔ metadata mirroring must hold for language + runtime.
    expect(enriched.metadata.original_language).toBe("Telugu");
    expect(enriched.metadata.runtime_minutes).toBe(87);
  });

  it("Basics stage is complete on resume — never re-asks for language/runtime", () => {
    const enriched = enrichForResume(HARSHIV_PERSISTED_ROW);
    const payload = {
      title: enriched.title,
      kind: "film",
      language: enriched.metadata.original_language,
      duration_minutes: enriched.metadata.runtime_minutes,
    };
    const r = validateStep(payload, getStep("basics")!);
    expect(r.complete).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it("next action on resume skips Basics and points at the first incomplete stage", () => {
    const enriched = enrichForResume(HARSHIV_PERSISTED_ROW);
    const payload = {
      title: enriched.title,
      kind: "film",
      language: enriched.metadata.original_language,
      duration_minutes: enriched.metadata.runtime_minutes,
    };
    const next = pickNextAction(payload);
    expect(next.stepId).not.toBe("basics");
    expect(next.stepId).toBe("story");
  });
});

describe("Harshiv fixture: idempotent draft id (no duplicate creation)", () => {
  const OWNER = "harshiv-user-id";
  const SLOT = "resume:bahumukham";

  beforeEach(() => {
    clearDraftId(OWNER, SLOT);
  });

  it("returns the same draft id across repeated resumes for the same slot", () => {
    const first = getOrCreateDraftId(OWNER, SLOT);
    const second = getOrCreateDraftId(OWNER, SLOT);
    const third = getOrCreateDraftId(OWNER, SLOT);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first).toMatch(/^[0-9a-f-]{8,}$/i);
  });

  it("returns distinct ids for different slots (parallel drafts allowed)", () => {
    const a = getOrCreateDraftId(OWNER, "resume:bahumukham");
    const b = getOrCreateDraftId(OWNER, "resume:second-title");
    expect(a).not.toBe(b);
  });
});
