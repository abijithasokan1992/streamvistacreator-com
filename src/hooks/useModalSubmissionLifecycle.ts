import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useModalSubmissionLifecycle
 *
 * Canonical submit → success-buffer → auto-close pattern used by every
 * primary data-submission modal in the app (payment top-up, onboarding
 * review, admin approvals, asset/metadata forms). Consolidating it here
 * guarantees:
 *
 *   1. Action buttons flip to `disabled` the instant a submission starts,
 *      eliminating double-invoke bugs on rapid double-click.
 *   2. Successful commits render a short success feedback state (default
 *      900ms) before the modal closes, so users get a clear "it worked"
 *      confirmation rather than a hard cut.
 *   3. Errors leave the modal open with the form state intact so the user
 *      can retry without re-entering data.
 *
 * `phase` values:
 *   - "idle"       → default, buttons enabled
 *   - "submitting" → in-flight RPC/fetch, buttons disabled
 *   - "success"    → success chrome shown, modal about to auto-close
 *   - "error"      → last submission failed, buttons re-enabled
 */
export type SubmissionPhase = "idle" | "submitting" | "success" | "error";

export interface UseModalSubmissionLifecycleOptions {
  /** Called after the success buffer elapses. Owner should close the modal. */
  onClose: () => void;
  /** How long to display the success feedback before auto-closing. */
  successHoldMs?: number;
}

export function useModalSubmissionLifecycle({
  onClose,
  successHoldMs = 900,
}: UseModalSubmissionLifecycleOptions) {
  const [phase, setPhase] = useState<SubmissionPhase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const submit = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return; // hard guard against double-submission
      inFlight.current = true;
      setPhase("submitting");
      try {
        const result = await fn();
        setPhase("success");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          inFlight.current = false;
          setPhase("idle");
          onClose();
        }, successHoldMs);
        return result;
      } catch (err) {
        inFlight.current = false;
        setPhase("error");
        throw err;
      }
    },
    [onClose, successHoldMs],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    inFlight.current = false;
    setPhase("idle");
  }, []);

  return {
    phase,
    isSubmitting: phase === "submitting",
    isSuccess: phase === "success",
    isError: phase === "error",
    /** True whenever action buttons should be disabled (submitting or during success hold). */
    isBusy: phase === "submitting" || phase === "success",
    submit,
    reset,
  };
}
