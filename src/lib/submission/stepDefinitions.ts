/**
 * Declarative step definitions for the guided title submission flow.
 *
 * DETERMINISTIC — no AI. The progress engine, next-action picker, and
 * validators read this catalog to compute state on the client without
 * touching a model.
 *
 * The canonical Creator/Studio submission flow has exactly FIVE stages:
 *   Basics → Story → Rights & Business → Assets → Review & Submit.
 *
 * To keep the diff small, existing consumers that referred to legacy
 * step ids ("synopsis", "cast_crew", "rights") can migrate to:
 *   synopsis  → story
 *   cast_crew → story (director now lives on Story)
 *   rights    → rights_business
 * The step ordering is preserved so downstream progress computations
 * remain stable.
 */
export type SubmissionStepId =
  | "basics"
  | "story"
  | "rights_business"
  | "assets"
  | "review";

export interface StepFieldSpec {
  /** Key on the submission payload. Dot-paths supported for nested fields. */
  key: string;
  /** true => required for the step to be considered "complete". */
  required: boolean;
  /** Optional min length for strings, min value for numbers. */
  min?: number;
  /** Optional max length for strings. */
  max?: number;
}

export interface StepDefinition {
  id: SubmissionStepId;
  order: number;
  /** i18n key for the step title — resolved via t(). */
  titleKey: string;
  /** i18n key for the step subtitle/description. */
  descriptionKey: string;
  /** Short user-visible fallback label (English) when i18n is unavailable. */
  fallbackLabel: string;
  fields: StepFieldSpec[];
}

export const SUBMISSION_STEPS: readonly StepDefinition[] = [
  {
    id: "basics",
    order: 1,
    titleKey: "submission.steps.basics.title",
    descriptionKey: "submission.steps.basics.description",
    fallbackLabel: "Basics",
    fields: [
      { key: "title", required: true, min: 1, max: 200 },
      { key: "kind", required: true },
      { key: "language", required: true },
      { key: "duration_minutes", required: true, min: 1 },
    ],
  },
  {
    id: "story",
    order: 2,
    titleKey: "submission.steps.story.title",
    descriptionKey: "submission.steps.story.description",
    fallbackLabel: "Story",
    fields: [
      { key: "synopsis", required: true, min: 80, max: 4000 },
      { key: "genre", required: true },
      { key: "crew.director", required: true, min: 1 },
      { key: "cast", required: false },
    ],
  },
  {
    id: "rights_business",
    order: 3,
    titleKey: "submission.steps.rights_business.title",
    descriptionKey: "submission.steps.rights_business.description",
    fallbackLabel: "Rights & Business",
    fields: [
      { key: "rights.owner_name", required: true, min: 1, max: 200 },
      { key: "rights.territory", required: true },
      { key: "rights.commercial_model", required: true },
      // Advanced fields (exclusivity, term dates, holdbacks, currency, tax,
      // share rates, windows, restrictions) stay behind a "More details"
      // disclosure and are not required for stage completion.
      { key: "rights.window", required: false },
      { key: "rights.exclusivity", required: false },
    ],
  },
  {
    id: "assets",
    order: 4,
    titleKey: "submission.steps.assets.title",
    descriptionKey: "submission.steps.assets.description",
    fallbackLabel: "Assets",
    fields: [
      { key: "assets.master_uploaded", required: true },
      { key: "assets.poster_uploaded", required: false },
      { key: "assets.trailer_uploaded", required: false },
      { key: "assets.subtitles_uploaded", required: false },
      { key: "assets.legal_uploaded", required: false },
    ],
  },
  {
    id: "review",
    order: 5,
    titleKey: "submission.steps.review.title",
    descriptionKey: "submission.steps.review.description",
    fallbackLabel: "Review & Submit",
    fields: [
      { key: "legal.accepted_terms", required: true },
    ],
  },
] as const;

export function getStep(id: SubmissionStepId): StepDefinition | undefined {
  return SUBMISSION_STEPS.find((s) => s.id === id);
}

/** Minimum synopsis length that unlocks the one-shot metadata call. */
export const SYNOPSIS_MIN_FOR_METADATA = 80;
