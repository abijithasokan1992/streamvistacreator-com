import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

/**
 * RemoveTitleDialog — two distinct paths:
 *
 *  1) Archive — immediate, reversible, keeps all records.
 *  2) Permanent Removal Request — creates a request that requires admin
 *     approval and honours the retention policy. Blocked if commercial or
 *     legal records reference the title.
 *
 * The creator never destroys content directly. Both actions emit a unique
 * Request ID and a full event trail.
 */

type Blocker = { type: string; count: number };
type Preflight = {
  title_id: string;
  file_count: number;
  blockers: Blocker[];
  can_archive: boolean;
  can_permanent: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  titleName?: string;
  onComplete?: (info: { requestId: string; mode: "archive" | "permanent" }) => void;
};

const BLOCKER_LABEL: Record<string,string> = {
  license_contracts: "License contracts",
  deal_memos: "Deal memos",
  invoices: "Invoices",
  manual_invoices: "Manual invoices",
  settlements: "Settlements",
  partner_statements: "Partner statements",
  distribution_deliveries: "Distribution deliveries",
  distribution_queue: "Distribution queue items",
  deal_deliveries: "Deal deliveries",
  legal_acceptances: "Legal acceptances",
};

export function RemoveTitleDialog({ open, onOpenChange, titleId, titleName, onComplete }: Props) {
  const [tab, setTab] = useState<"archive" | "permanent">("archive");
  const [pre, setPre] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expected = "REMOVE";

  useEffect(() => {
    if (!open) return;
    setPre(null); setReason(""); setConfirm(""); setTab("archive");
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any).rpc("title_removal_preflight", { _title_id: titleId });
      if (error) toast.error(error.message || "Preflight failed");
      else setPre(data as Preflight);
      setLoading(false);
    })();
  }, [open, titleId]);

  const blockers = pre?.blockers ?? [];
  const canPermanent = !!pre?.can_permanent;

  const submit = async () => {
    setSubmitting(true);
    try {
      if (tab === "archive") {
        const { data, error } = await (supabase as any).rpc("title_request_archive", {
          _title_id: titleId, _reason: reason || null,
        });
        if (error) throw error;
        toast.success(`Archived · Request ${shortId(data)}`);
        onComplete?.({ requestId: data as string, mode: "archive" });
      } else {
        if (confirm.trim() !== expected) { toast.error("Type REMOVE to confirm"); return; }
        const { data, error } = await (supabase as any).rpc("title_request_permanent_removal", {
          _title_id: titleId, _reason: reason || null,
        });
        if (error) throw error;
        toast.success(`Removal request submitted · ${shortId(data)}`);
        onComplete?.({ requestId: data as string, mode: "permanent" });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Remove Title{titleName ? ` — ${titleName}` : ""}</DialogTitle>
          <DialogDescription>
            Choose <b>Archive</b> to hide the title while keeping every record, or submit a
            <b> Permanent Removal Request</b> for admin review.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="archive"><Archive className="w-4 h-4 mr-2" />Archive</TabsTrigger>
            <TabsTrigger value="permanent"><ShieldAlert className="w-4 h-4 mr-2" />Permanent Removal Request</TabsTrigger>
          </TabsList>

          <TabsContent value="archive" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              The title is hidden from your active workspace but every asset, contract, invoice and
              audit record is preserved. Reversible by an admin.
            </p>
            <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </TabsContent>

          <TabsContent value="permanent" className="space-y-3 pt-3">
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Checking eligibility…</div>}
            {!loading && pre && (
              <>
                <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs space-y-1">
                  <div><b>Linked files:</b> {pre.file_count}</div>
                </div>

                {blockers.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-amber-500 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Permanent removal is blocked
                    </div>
                    <p className="text-muted-foreground mb-2">
                      This title has commercial or legal records. It must be archived, not destroyed.
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {blockers.map((b) => (
                        <li key={b.type}>{BLOCKER_LABEL[b.type] ?? b.type}: {b.count}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Textarea placeholder="Reason for removal (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="text-xs text-muted-foreground">Type <b>REMOVE</b> to confirm your request.</div>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="REMOVE" />
                <p className="text-[11px] text-muted-foreground">
                  This creates an admin-reviewed request. After approval a retention window
                  applies before any files are purged. The request can be cancelled until purge begins.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              (tab === "permanent" && (!canPermanent || confirm.trim() !== expected || !reason.trim()))
            }
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tab === "archive" ? "Archive Title" : "Submit Removal Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function shortId(id: string | null | undefined): string {
  if (!id) return "REQ";
  return `REQ-${id.slice(0, 8).toUpperCase()}`;
}

export default RemoveTitleDialog;
