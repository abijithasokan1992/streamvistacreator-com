import { useState } from "react";
import { Loader2, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ServiceKind = "qc" | "mastering" | "anti_piracy" | "delivery_prep" | "ingest" | "other";

const SERVICE_LABEL: Record<ServiceKind, string> = {
  qc: "QC review",
  mastering: "Mastering / packaging",
  anti_piracy: "Anti-piracy / watermark / protected screening",
  delivery_prep: "Delivery prep (DCP / OTT / archive)",
  ingest: "Ingest / migration support",
  other: "Other operator service",
};

/**
 * Studio-side entry point that lands in `support_requests` with the normalized
 * metadata convention (`surface: "studio"`, `service_kind`). Admin queues it in
 * the Service Requests tab of the Commercial Control Tower.
 */
export default function StudioRequestService() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ServiceKind>("qc");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "high">("normal");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    if (!subject.trim() || !message.trim()) { toast.error("Subject and details are required."); return; }
    setBusy(true);
    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id,
      request_type: "service",
      subject: `[Studio · ${SERVICE_LABEL[kind]}] ${subject.trim()}`.slice(0, 240),
      message: message.trim(),
      metadata: { surface: "studio", service_kind: kind, urgency },
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service request submitted. Admin will follow up.");
    setOpen(false);
    setSubject(""); setMessage(""); setKind("qc"); setUrgency("normal");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Settings2 className="w-4 h-4 mr-1.5" /> Request a service</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a vault / operator service</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Service</label>
            <Select value={kind} onValueChange={(v) => setKind(v as ServiceKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SERVICE_LABEL) as ServiceKind[]).map(k => (
                  <SelectItem key={k} value={k}>{SERVICE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Subject</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} placeholder="e.g. QC for Feature_X_final_master.mxf" />
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Details</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={2000}
              placeholder="Scope, timeline, asset locations, contacts, expected deliverables." />
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Urgency</label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as "normal" | "high")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Goes to the StreamVista operations team. Pricing is confirmed before any paid work begins — submitting this is not a payment.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
