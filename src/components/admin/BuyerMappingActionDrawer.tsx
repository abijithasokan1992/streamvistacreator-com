import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Send, Ban, ArrowRight } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Buyer Mapping action drawer — drives an offer through its lifecycle
 *   draft → offered → accepted | rejected | cancelled | expired
 * with plain-language status steps, per-action validation, and an
 * optimistic realtime-friendly update path so the Buyer Mapping room
 * reflects the new status instantly.
 */

export type OfferStatus = "draft" | "offered" | "accepted" | "rejected" | "cancelled" | "expired";

export interface BuyerOffer {
  id: string;
  program_name: string;
  status: OfferStatus;
  offer_amount?: number | null;
  currency?: string | null;
  term_years?: number | null;
  term_start_date?: string | null;
  term_end_date?: string | null;
  updated_at?: string;
}

interface Props {
  offer: BuyerOffer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: (next: BuyerOffer) => void;
}

const STEPS: Array<{ id: OfferStatus; label: string; hint: string }> = [
  { id: "draft",    label: "Draft",       hint: "Being prepared" },
  { id: "offered",  label: "Sent to buyer", hint: "Awaiting response" },
  { id: "accepted", label: "Mapped",      hint: "Buyer accepted" },
];

// Actions permitted per current status. Kept intentionally narrow so admins
// can't skip states or reopen closed deals from the UI.
const NEXT_ACTIONS: Record<OfferStatus, Array<{ to: OfferStatus; label: string; tone: "primary" | "success" | "danger" | "muted"; needsReason?: boolean }>> = {
  draft:     [{ to: "offered",   label: "Send to buyer",  tone: "primary" },
              { to: "cancelled", label: "Cancel offer",   tone: "muted", needsReason: true }],
  offered:   [{ to: "accepted",  label: "Mark as mapped", tone: "success" },
              { to: "rejected",  label: "Mark rejected",  tone: "danger", needsReason: true },
              { to: "cancelled", label: "Withdraw offer", tone: "muted",  needsReason: true },
              { to: "expired",   label: "Mark expired",   tone: "muted" }],
  accepted:  [],
  rejected:  [],
  cancelled: [],
  expired:   [],
};

const reasonSchema = z.string().trim().min(4, "Reason must be at least 4 characters").max(500, "Reason must be under 500 characters");

function StatusPill({ status }: { status: OfferStatus }) {
  const map: Record<OfferStatus, string> = {
    draft:     "bg-muted text-muted-foreground",
    offered:   "bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30",
    accepted:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30",
    rejected:  "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
    cancelled: "bg-muted text-muted-foreground",
    expired:   "bg-muted text-muted-foreground",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", map[status])}>{status}</span>;
}

function Stepper({ status }: { status: OfferStatus }) {
  const idx = STEPS.findIndex((s) => s.id === status);
  const failed = status === "rejected" || status === "cancelled" || status === "expired";
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = !failed && i <= idx;
        const active = !failed && i === idx;
        return (
          <li key={s.id} className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ring-1",
              done ? "bg-primary text-primary-foreground ring-primary"
                   : "bg-background text-muted-foreground ring-border",
              active && "shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
            )}>{i + 1}</div>
            <div className="min-w-0">
              <div className={cn("text-xs font-medium truncate", done ? "text-foreground" : "text-muted-foreground")}>{s.label}</div>
              <div className="text-[10px] text-muted-foreground/80 truncate">{s.hint}</div>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 mx-1 shrink-0" />}
          </li>
        );
      })}
      {failed && (
        <li className="ml-2 text-[11px] text-destructive font-medium uppercase tracking-wider">Closed: {status}</li>
      )}
    </ol>
  );
}

export function BuyerMappingActionDrawer({ offer, open, onOpenChange, onChanged }: Props) {
  const [pending, setPending] = useState<OfferStatus | null>(null);
  const [reason, setReason] = useState("");
  const [selectedAction, setSelectedAction] = useState<OfferStatus | null>(null);

  useEffect(() => {
    if (!open) { setReason(""); setSelectedAction(null); setPending(null); }
  }, [open]);

  const actions = useMemo(() => (offer ? NEXT_ACTIONS[offer.status] : []), [offer]);
  const activeAction = actions.find((a) => a.to === selectedAction) ?? null;
  const needsReason = !!activeAction?.needsReason;

  const commit = async (next: OfferStatus, note?: string) => {
    if (!offer) return;
    setPending(next);
    // Optimistic patch bubbled up so the parent list reflects immediately;
    // the realtime channel confirms shortly after.
    const optimistic: BuyerOffer = { ...offer, status: next, updated_at: new Date().toISOString() };
    onChanged?.(optimistic);

    try {
      const nowIso = new Date().toISOString();
      const patch: {
        status: OfferStatus;
        offered_at?: string;
        accepted_at?: string;
        rejected_at?: string;
        legal_text_snapshot?: string;
      } = { status: next };
      if (next === "offered")  patch.offered_at  = nowIso;
      if (next === "accepted") patch.accepted_at = nowIso;
      if (next === "rejected") patch.rejected_at = nowIso;
      if (note && (next === "cancelled" || next === "rejected")) {
        patch.legal_text_snapshot = note;
      }
      const { data, error } = await supabase
        .from("distribution_program_offers")
        .update(patch)
        .eq("id", offer.id)
        .select("id,program_name,status,updated_at")
        .maybeSingle();
      if (error) throw error;
      toast.success(`Offer moved to "${next}"`);
      if (data) onChanged?.({ ...offer, ...(data as any) });
      onOpenChange(false);
    } catch (e: any) {
      // Roll back optimistic patch by re-emitting original state.
      onChanged?.(offer);
      toast.error("Couldn't update the offer", { description: e?.message ?? "Please try again." });
    } finally {
      setPending(null);
    }
  };

  const onSubmitAction = async () => {
    if (!offer || !selectedAction) return;
    if (needsReason) {
      const parsed = reasonSchema.safeParse(reason);
      if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Reason required"); return; }
      await commit(selectedAction, parsed.data);
    } else {
      await commit(selectedAction);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Buyer Mapping</SheetDescription>
          <SheetTitle className="font-display text-xl">{offer?.program_name ?? "Offer"}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            {offer && <StatusPill status={offer.status} />}
            {offer?.currency && offer.offer_amount != null && (
              <span className="text-xs text-muted-foreground">
                {offer.currency} {Number(offer.offer_amount).toLocaleString("en-IN")}
              </span>
            )}
            {offer?.term_years ? <span className="text-xs text-muted-foreground">· {offer.term_years} yr term</span> : null}
          </div>
        </SheetHeader>

        {offer && (
          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-border/60 bg-card p-4">
              <div className="text-xs text-muted-foreground mb-3">Where this offer stands</div>
              <Stepper status={offer.status} />
            </section>

            <section className="space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Next action</div>
              {actions.length === 0 ? (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
                  This offer is closed. No further actions available.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {actions.map((a) => {
                    const selected = selectedAction === a.to;
                    return (
                      <button
                        key={a.to}
                        onClick={() => setSelectedAction(a.to)}
                        className={cn(
                          "text-left rounded-lg border px-3 py-2.5 transition-colors",
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border/60 hover:bg-secondary/30",
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {a.tone === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {a.tone === "danger"  && <XCircle className="w-4 h-4 text-destructive" />}
                          {a.tone === "primary" && <Send className="w-4 h-4 text-primary" />}
                          {a.tone === "muted"   && <Ban className="w-4 h-4 text-muted-foreground" />}
                          {a.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Moves to <span className="font-medium">{a.to}</span></div>
                      </button>
                    );
                  })}
                </div>
              )}

              {needsReason && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="offer-reason" className="text-xs">Reason (required, min 4 chars)</Label>
                  <Textarea
                    id="offer-reason"
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this offer is being closed. Visible in audit history."
                    className="min-h-[90px]"
                  />
                  <div className="text-[10px] text-muted-foreground text-right">{reason.length}/500</div>
                </div>
              )}

              {activeAction && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setSelectedAction(null); setReason(""); }} disabled={!!pending}>
                    Cancel
                  </Button>
                  <Button onClick={onSubmitAction} disabled={!!pending} className="min-w-[140px]">
                    {pending === activeAction.to ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</>
                    ) : (
                      <>Confirm: {activeAction.label}</>
                    )}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
