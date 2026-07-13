/**
 * Declarative step definitions for the guided title submission flow.
 *
 * DETERMINISTIC — no AI. The progress engine, next-action picker, and
 * validators read this catalog to compute state on the client without
 * touching a model.
 *
 * To add or reorder a step: edit this file. Every consumer picks it up
 * automatically.
 */
export type SubmissionStepId =
  | "basics"
  | "synopsis"
  | "rights"
  | "cast_crew"
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
  fields: StepFieldSpec[];
}

export const SUBMISSION_STEPS: readonly StepDefinition[] = [
  {
    id: "basics",
    order: 1,
    titleKey: "submission.steps.basics.title",
    descriptionKey: "submission.steps.basics.description",
    fields: [
      { key: "title", required: true, min: 1, max: 200 },
      { key: "language", required: true },
      { key: "duration_minutes", required: true, min: 1 },
      { key: "kind", required: true },
    ],
  },
  {
    id: "synopsis",
    order: 2,
    titleKey: "submission.steps.synopsis.title",
    descriptionKey: "submission.steps.synopsis.description",
    fields: [
      { key: "synopsis", required: true, min: 80, max: 4000 },
    ],
  },
  {
    id: "rights",
    order: 3,
    titleKey: "submission.steps.rights.title",
    descriptionKey: "submission.steps.rights.description",
    fields: [
      { key: "rights.owner_name", required: true, min: 1, max: 200 },
      { key: "rights.territory", required: true },
      { key: "rights.window", required: false },
    ],
  },
  {
    id: "cast_crew",
    order: 4,
    titleKey: "submission.steps.cast_crew.title",
    descriptionKey: "submission.steps.cast_crew.description",
    fields: [
      { key: "cast", required: false },
      { key: "crew.director", required: true, min: 1 },
    ],
  },
  {
    id: "assets",
    order: 5,
    titleKey: "submission.steps.assets.title",
    descriptionKey: "submission.steps.assets.description",
    fields: [
      { key: "assets.master_uploaded", required: true },
      { key: "assets.poster_uploaded", required: false },
    ],
  },
  {
    id: "review",
    order: 6,
    titleKey: "submission.steps.review.title",
    descriptionKey: "submission.steps.review.description",
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
