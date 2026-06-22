import { useState } from "react";
import { Loader2, Send, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Founder-assisted Studio plan change request. Writes to support_requests with:
 *   request_type = 'plan_upgrade'
 *   metadata.surface = 'studio'
 *   metadata.request_kind = 'plan_change'
 *   metadata.current_plan, requested_plan, storage_need_tb, team_size, notes
 *
 * Does NOT trigger any payment flow. Admin reviews from the Plan/Upgrade queue
 * in the Commercial Control Tower.
 */
export default function StudioRequestPlanChange() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("");
  const [requestedPlan, setRequestedPlan] = useState("studio_pro");
  const [storageNeedTb, setStorageNeedTb] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    if (!notes.trim()) { toast.error("Please describe what you need."); return; }
    setBusy(true);
    const subject = `[Studio · Plan change → ${requestedPlan}] ${currentPlan ? `from ${currentPlan} · ` : ""}${user.email ?? ""}`.slice(0, 240);
    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id,
      request_type: "plan_upgrade",
      subject,
      message: notes.trim(),
      metadata: {
        surface: "studio",
        request_kind: "plan_change",
        current_plan: currentPlan.trim() || null,
        requested_plan: requestedPlan,
        storage_need_tb: storageNeedTb ? Number(storageNeedTb) : null,
        team_size: teamSize ? Number(teamSize) : null,
      },
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plan change request submitted. Our team will contact you shortly.");
    setOpen(false);
    setCurrentPlan(""); setRequestedPlan("studio_pro"); setStorageNeedTb(""); setTeamSize(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><ArrowUpRight className="w-4 h-4 mr-1.5" /> Request Plan Change</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a Studio plan change</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Studio plans are founder-assisted because they bundle workflow, archive posture, onboarding, SLAs and team access. Submit this request and our team will scope, price and activate the plan with you — no checkout happens here.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Current plan (optional)</label>
              <Input value={currentPlan} onChange={e => setCurrentPlan(e.target.value)} placeholder="e.g. Studio Starter / Free / N/A" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested plan</label>
              <Select value={requestedPlan} onValueChange={setRequestedPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="studio_starter">Studio Starter</SelectItem>
                  <SelectItem value="studio_pro">Studio Pro</SelectItem>
                  <SelectItem value="studio_enterprise">Studio Enterprise</SelectItem>
                  <SelectItem value="custom">Custom / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Storage need (TB, optional)</label>
              <Input type="number" min={0} value={storageNeedTb} onChange={e => setStorageNeedTb(e.target.value)} placeholder="e.g. 10" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Team size (optional)</label>
              <Input type="number" min={0} value={teamSize} onChange={e => setTeamSize(e.target.value)} placeholder="e.g. 8" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes for our team</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} maxLength={2000}
              placeholder="What you're working on, expected workflow load, archive needs, SLAs, billing cadence preference, contact for follow-up." />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Submit request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
