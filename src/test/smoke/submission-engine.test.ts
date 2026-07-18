/**
 * Smoke test for the deterministic submission engine.
 * Verifies that progress / next-action / validation run without ANY AI.
 */
import { describe, expect, it } from "vitest";
import {
  computeProgress,
  pickNextAction,
  validateAll,
  validateStep,
  getStep,
  SUBMISSION_STEPS,
} from "@/lib/submission";

const empty = {};

const partial = {
  title: "My Film",
  language: "ml",
  duration_minutes: 120,
  kind: "film",
  synopsis: "x".repeat(200),
  genre: "Drama",
  crew: { director: "A. Director" },
};

const full = {
  ...partial,
  rights: { owner_name: "Studio X", territory: "IN", commercial_model: "SVOD" },
  assets: { master_uploaded: true },
  legal: { accepted_terms: true },
};

describe("submission engine — deterministic, zero AI", () => {
  it("progress on an empty payload is 0%", () => {
    const p = computeProgress(empty);
    expect(p.percent).toBe(0);
    expect(p.completedStepIds).toHaveLength(0);
  });

  it("progress on a full payload is 100%", () => {
    const p = computeProgress(full);
    expect(p.percent).toBe(100);
    expect(p.completedStepIds).toEqual(SUBMISSION_STEPS.map((s) => s.id));
  });

  it("pickNextAction points at the first incomplete step", () => {
    const next = pickNextAction(partial);
    expect(next.submissionReady).toBe(false);
    expect(next.stepId).toBe("rights_business");
    expect(next.missingFieldKeys).toContain("rights.owner_name");
  });

  it("pickNextAction returns review when everything is complete", () => {
    const next = pickNextAction(full);
    expect(next.submissionReady).toBe(true);
    expect(next.stepId).toBe("review");
  });

  it("validateStep flags a short synopsis with the minLength key", () => {
    const step = getStep("story")!;
    const result = validateStep({ synopsis: "too short", genre: "Drama", crew: { director: "D" } }, step);
    expect(result.complete).toBe(false);
    const synopsisIssue = result.missing.find((m) => m.key === "synopsis");
    expect(synopsisIssue?.errorKey).toBe("submission.validation.minLength");
  });

  it("validateAll returns one result per step", () => {
    expect(validateAll(empty)).toHaveLength(SUBMISSION_STEPS.length);
  });
});
