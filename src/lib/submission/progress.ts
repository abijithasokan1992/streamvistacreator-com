/**
 * Progress + next-action selection for the guided submission flow.
 * DETERMINISTIC — no AI, no network. Runs against the in-memory payload.
 */
import { SUBMISSION_STEPS, type SubmissionStepId } from "./stepDefinitions";
import { validateStep, type StepValidationResult, type SubmissionPayload } from "./validation";

export interface ProgressSnapshot {
  /** 0..1 fraction of required fields completed across all steps. */
  fraction: number;
  /** 0..100 rounded percent. */
  percent: number;
  perStep: StepValidationResult[];
  completedStepIds: SubmissionStepId[];
  totalRequired: number;
  totalDone: number;
}

export function computeProgress(payload: SubmissionPayload): ProgressSnapshot {
  const perStep = SUBMISSION_STEPS.map((s) => validateStep(payload, s));
  let totalRequired = 0;
  let totalDone = 0;
  for (const step of SUBMISSION_STEPS) {
    const requiredFields = step.fields.filter((f) => f.required);
    totalRequired += requiredFields.length;
    const stepResult = perStep.find((r) => r.step === step.id)!;
    const missingRequired = stepResult.missing.filter((m) => {
      const spec = step.fields.find((f) => f.key === m.key);
      return spec?.required;
    }).length;
    totalDone += requiredFields.length - missingRequired;
  }
  const fraction = totalRequired === 0 ? 1 : totalDone / totalRequired;
  return {
    fraction,
    percent: Math.round(fraction * 100),
    perStep,
    completedStepIds: perStep.filter((r) => r.complete).map((r) => r.step),
    totalRequired,
    totalDone,
  };
}

export interface NextAction {
  /** Step the creator should visit next. */
  stepId: SubmissionStepId;
  /** Whether the whole submission is ready for final review. */
  submissionReady: boolean;
  /** i18n key describing the recommended action. */
  labelKey: string;
  /** Missing field keys on that step, in step order. */
  missingFieldKeys: string[];
}

/**
 * Pick the next step the creator should work on:
 *   1. First incomplete step in order.
 *   2. If everything is complete, return the review step.
 */
export function pickNextAction(payload: SubmissionPayload): NextAction {
  const progress = computeProgress(payload);
  const firstIncomplete = progress.perStep.find((r) => !r.complete);
  if (!firstIncomplete) {
    return {
      stepId: "review",
      submissionReady: true,
      labelKey: "submission.nextAction.readyForReview",
      missingFieldKeys: [],
    };
  }
  return {
    stepId: firstIncomplete.step,
    submissionReady: false,
    labelKey: "submission.nextAction.finishStep",
    missingFieldKeys: firstIncomplete.missing.map((m) => m.key),
  };
}
