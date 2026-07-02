import { useState } from "react";
import { ShieldAlert, Lock, Globe, Tv, IndianRupee, Clock, X, Loader2 } from "lucide-react";

/**
 * Free-tier submission terms confirmation.
 * Shown before a free Creator's title is submitted to admin.
 * If the user does not accept, the title stays as a draft — uploads are preserved.
 */
export function FreeSubmissionTermsModal({
  open, onCancel, onConfirm, submitting,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}) {
  const [ack, setAck] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/40">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <ShieldAlert className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Free Submission Agreement</p>
              <h2 className="font-display text-lg mt-0.5">Confirm submission to StreamVista</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                You're submitting under the StreamVista free creator path. Please review the commercial terms before continuing.
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <Term icon={ShieldAlert} title="Admin-controlled licensing"
            body="Free submissions are treated as admin-controlled licensing submissions. Licensing decisions are made by the StreamVista admin / business team." />
          <Term icon={Globe} title="No territory blocking"
            body="Territory blocking is not included on the free path." />
          <Term icon={Tv} title="No channel blocking"
            body="Channel blocking is not included on the free path. Advanced rights-sales servicing is reserved for paid / managed plans." />
          <Term icon={Lock} title="5-year Digital + Satellite lock-in"
            body="Content submitted under the free path is locked with StreamVista for 5 years for Digital and Satellite exploitation / handling." />
          <Term icon={IndianRupee} title="Takedown requires admin approval"
            body="To withdraw the title from this arrangement later, admin approval is required and a takedown fee of ₹25,000 + GST applies." />
          <Term icon={Clock} title="Standard review timelines"
            body="Free submissions follow standard review turnaround. Premium / priority review and managed support are paid-plan features." />

          <label className="mt-2 flex items-start gap-2.5 rounded-lg border border-border/50 bg-secondary/10 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="text-xs leading-relaxed">
              I have read and accept the free-tier submission terms above, including the 5-year Digital + Satellite
              lock-in and the ₹25,000 + GST takedown fee. I understand my title will enter the StreamVista admin-controlled
              free licensing path.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-border/40 bg-secondary/5">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-border/50 text-xs px-3 py-2 hover:bg-secondary/30 disabled:opacity-50"
          >
            Not now / Exit
          </button>
          <button
            onClick={onConfirm}
            disabled={!ack || submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-4 py-2 disabled:opacity-40"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Continue and submit
          </button>
        </div>
      </div>
    </div>
  );
}

function Term({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-secondary/5 p-3">
      <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
