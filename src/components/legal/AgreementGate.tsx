import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  type AgreementType,
  type LegalAgreement,
  fetchCurrentAgreement,
  hasAcceptedCurrent,
  recordAcceptance,
} from "@/lib/legal/agreements";

type Props = {
  type: AgreementType;
  /** Called once the user has accepted (or had already accepted) the current version. */
  onAccepted: () => void;
  /** Called when the user dismisses the modal without accepting. */
  onCancel: () => void;
  /** Optional context recorded with the acceptance (e.g. titleId, requestType). */
  context?: Record<string, unknown>;
};

/**
 * Modal that loads the current legal agreement of the given type, shows it to
 * the user, and records an acceptance row before calling onAccepted().
 * If the user already accepted the current version, onAccepted() fires immediately.
 */
export function AgreementGate({ type, onAccepted, onCancel, context }: Props) {
  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<LegalAgreement | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await hasAcceptedCurrent(type)) {
          if (!cancelled) onAccepted();
          return;
        }
        const a = await fetchCurrentAgreement(type);
        if (cancelled) return;
        if (!a) { setMissing(true); setLoading(false); return; }
        setAgreement(a);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load agreement.");
        onCancel();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const submit = async () => {
    if (!agreement || !agreed) return;
    setBusy(true);
    try {
      await recordAcceptance(agreement, context);
      onAccepted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record acceptance.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }

  if (missing || !agreement) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
        <div className="bg-background border border-border/50 rounded-2xl w-full max-w-md p-5">
          <p className="font-semibold">Agreement unavailable</p>
          <p className="text-sm text-muted-foreground mt-1">
            This action requires a legal agreement that is not yet published. Please try again later.
          </p>
          <div className="mt-4 flex justify-end">
            <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-md border border-border/50">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-background border border-border/50 rounded-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <h2 className="font-semibold truncate">{agreement.title}</h2>
            </div>
            {agreement.summary && (
              <p className="text-xs text-muted-foreground mt-1">{agreement.summary}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Version {agreement.version}
              {agreement.published_at ? ` · Published ${new Date(agreement.published_at).toLocaleDateString()}` : ""}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed">
          {agreement.body}
        </div>

        <div className="border-t border-border/40 px-5 py-3 flex flex-col gap-3">
          <label className="flex items-start gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have read and agree to the terms above. I understand StreamVista will record my
              acceptance with timestamp for compliance purposes.
            </span>
          </label>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!agreed || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Accept &amp; continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
