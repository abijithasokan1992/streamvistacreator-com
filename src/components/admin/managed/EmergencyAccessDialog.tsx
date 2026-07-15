import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createEmergencyAccessGrant } from "@/lib/managed/auditApi";
import { toast } from "@/hooks/use-toast";

/**
 * Admin dialog to request time-limited emergency access to a specific title.
 * The reason is required and persisted. Ownership never changes.
 */
export default function EmergencyAccessDialog({
  open, onOpenChange, contentTitleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentTitleId: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) return;
    if (reason.trim().length < 10) {
      toast({ title: "Reason too short", description: "Please provide at least 10 characters.", variant: "destructive" });
      return;
    }
    try {
      setBusy(true);
      await createEmergencyAccessGrant({
        adminId: user.id, contentTitleId, reason: reason.trim(), minutes,
      });
      toast({ title: "Emergency access granted", description: `Expires in ${minutes} minutes. Audited.` });
      onOpenChange(false);
      setReason(""); setMinutes(60);
    } catch (err) {
      toast({
        title: "Could not grant access",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request emergency access</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Time-limited support access. The reason is recorded in the audit trail and visible to the customer.
          Ownership is not transferred.
        </p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground">Reason (required)</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} minLength={10} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (minutes)</label>
            <Input type="number" min={5} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 60)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Granting…" : "Grant access"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
