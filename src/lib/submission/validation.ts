/**
 * Deterministic field validation for the guided submission flow.
 * ZERO AI — pure application logic on the client.
 */
import { SUBMISSION_STEPS, type StepDefinition, type StepFieldSpec, type SubmissionStepId } from "./stepDefinitions";

export type SubmissionPayload = Record<string, unknown>;

export interface FieldValidationResult {
  key: string;
  ok: boolean;
  /** i18n error key if not ok. */
  errorKey?: string;
  /** Interpolation params for the error message. */
  errorParams?: Record<string, string | number>;
}

/** Read a nested value with a dot-path key, e.g. "rights.owner_name". */
export function readField(payload: SubmissionPayload, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, payload);
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "boolean") return v === false;
  return false;
}

export function validateField(payload: SubmissionPayload, spec: StepFieldSpec): FieldValidationResult {
  const raw = readField(payload, spec.key);
  if (spec.required && isEmpty(raw)) {
    return { key: spec.key, ok: false, errorKey: "submission.validation.required" };
  }
  if (typeof raw === "string") {
    if (spec.min !== undefined && raw.trim().length < spec.min) {
      return {
        key: spec.key,
        ok: false,
        errorKey: "submission.validation.minLength",
        errorParams: { min: spec.min },
      };
    }
    if (spec.max !== undefined && raw.length > spec.max) {
      return {
        key: spec.key,
        ok: false,
        errorKey: "submission.validation.maxLength",
        errorParams: { max: spec.max },
      };
    }
  }
  if (typeof raw === "number" && spec.min !== undefined && raw < spec.min) {
    return { key: spec.key, ok: false, errorKey: "submission.validation.minValue", errorParams: { min: spec.min } };
  }
  return { key: spec.key, ok: true };
}

export interface StepValidationResult {
  step: SubmissionStepId;
  complete: boolean;
  missing: FieldValidationResult[];
}

export function validateStep(payload: SubmissionPayload, step: StepDefinition): StepValidationResult {
  const results = step.fields.map((f) => validateField(payload, f));
  const missing = results.filter((r) => !r.ok);
  return { step: step.id, complete: missing.length === 0, missing };
}

export function validateAll(payload: SubmissionPayload): StepValidationResult[] {
  return SUBMISSION_STEPS.map((s) => validateStep(payload, s));
}
