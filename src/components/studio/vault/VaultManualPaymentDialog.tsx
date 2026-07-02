import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2, Smartphone, FileText, Copy, Check, Upload, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtINRDecimal, VaultProduct, IntervalMonths, computePricePreview } from "@/lib/studioVault";

type Rail = "bank_transfer" | "upi_manual" | "invoice_offline";

type PMC = {
  id: string; rail: string; display_name: string;
  beneficiary_name: string | null; bank_name: string | null;
  account_number: string | null; ifsc: string | null; branch: string | null;
  upi_id: string | null; qr_image_path: string | null;
  instructions: string | null; support_contact: string | null;
};

type Props = {
  product: VaultProduct | null;
  tb: number;
  months: IntervalMonths;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted?: () => void;
};

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
    >
      {done ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} {done ? "copied" : "copy"}
    </button>
  );
}

export default function VaultManualPaymentDialog({ product, tb, months, open, onOpenChange, onSubmitted }: Props) {
  const { user } = useAuth();
  const [rail, setRail] = useState<Rail>("bank_transfer");
  const [configs, setConfigs] = useState<PMC[]>([]);
  const [stage, setStage] = useState<"choose" | "instructions" | "proof" | "done">("choose");
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [topupId, setTopupId] = useState<string | null>(null);

  // Proof form
  const [utr, setUtr] = useState("");
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [bankName, setBankName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const priced = useMemo(() => (product ? computePricePreview(product, tb, months) : null), [product, tb, months]);

  useEffect(() => {
    if (!open) return;
    setStage("choose"); setOrderId(null); setTopupId(null);
    setUtr(""); setBankName(""); setRemarks(""); setFile(null);
    setConfigs([]);
  }, [open]);

  const matching = configs.filter(c => c.rail === rail);

  const createOrder = async () => {
    if (!product || !user) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_manual_vault_order", {
      _vault_product_id: product.id,
      _billing_interval_months: months,
      _payment_mode: rail,
      _customer_note: null,
    });
    if (error) { setBusy(false); toast.error(error.message); return; }
    const d = data as any;
    setOrderId(d.order_id); setTopupId(d.topup_id);
    // Fetch payment method configs *after* the order exists, through a
    // SECURITY DEFINER RPC that only returns details for an order the caller owns.
    const { data: pmcRows } = await (supabase as any).rpc(
      "get_payment_method_configs_for_my_order",
      { _order_id: d.order_id },
    );
    setConfigs((pmcRows as PMC[]) ?? []);
    setBusy(false);
    if (rail === "invoice_offline") {
      setStage("done");
      toast.success("Order created. Our team will reach out with the invoice.");
      onSubmitted?.();
    } else {
      setStage("instructions");
    }
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!file || !user) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${orderId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("billing-proofs").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
    return path;
  };

  const submitProof = async () => {
    if (!orderId) return;
    if (!utr.trim()) { toast.error("UTR / reference number is required"); return; }
    setBusy(true);
    const proofPath = file ? await uploadProof() : null;
    if (file && !proofPath) { setBusy(false); return; }
    const { error } = await supabase.rpc("submit_manual_payment_proof", {
      _order_id: orderId,
      _payment_channel: rail,
      _amount_paid_paise: priced ? Math.round(priced.total * 100) : 0,
      _paid_at: new Date(paidAt).toISOString(),
      _utr_or_reference: utr,
      _bank_name: bankName || null,
      _payer_name: null, _payer_phone: null, _payer_email: user?.email ?? null,
      _remarks: remarks || null,
      _proof_file_path: proofPath,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Proof submitted. Finance team will review shortly.");
    setStage("done");
    onSubmitted?.();
  };

  if (!product || !priced) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual payment — {product.name}</DialogTitle>
          <DialogDescription>
            {tb} TB · {months} month{months > 1 ? "s" : ""} · Total {fmtINRDecimal(priced.total)}
          </DialogDescription>
        </DialogHeader>

        {stage === "choose" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {(["bank_transfer", "upi_manual", "invoice_offline"] as Rail[]).map(r => {
                const icon = r === "bank_transfer" ? Building2 : r === "upi_manual" ? Smartphone : FileText;
                const Icon = icon;
                const label = r === "bank_transfer" ? "Bank transfer (NEFT / RTGS / IMPS)"
                  : r === "upi_manual" ? "UPI (manual proof)"
                  : "Request invoice / offline payment";
                return (
                  <button key={r} type="button" onClick={() => setRail(r)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${rail === r ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                    <Icon className="w-4 h-4 text-primary" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r === "invoice_offline" ? "We'll email an invoice; pay via wire/cheque. Storage activates after approval." : "Pay via your bank/UPI, then submit the reference for review. Storage activates after approval."}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
              Manual payments are reviewed by our finance team within 1 business day. Storage is activated after approval.
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={createOrder} disabled={busy}>
                {busy && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />} Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "instructions" && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">Order reference</div>
            <div className="font-mono text-xs bg-muted/30 rounded p-2 break-all">{orderId}</div>

            {matching.length === 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                No {rail.replace("_", " ")} method is configured yet. Please contact support to proceed, or pick a different mode.
              </div>
            )}

            {matching.map(c => (
              <div key={c.id} className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-2 text-sm">
                <div className="font-semibold">{c.display_name}</div>
                {c.beneficiary_name && <Row label="Beneficiary" value={c.beneficiary_name} />}
                {c.bank_name && <Row label="Bank" value={c.bank_name} />}
                {c.account_number && <Row label="A/C No." value={c.account_number} copyable />}
                {c.ifsc && <Row label="IFSC" value={c.ifsc} copyable />}
                {c.branch && <Row label="Branch" value={c.branch} />}
                {c.upi_id && <Row label="UPI ID" value={c.upi_id} copyable />}
                <Row label="Amount" value={fmtINRDecimal(priced.total)} copyable />
                <Row label="Order ref" value={orderId!} copyable />
                {c.instructions && <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">{c.instructions}</div>}
                {c.support_contact && <div className="text-[11px] text-muted-foreground">Help: {c.support_contact}</div>}
              </div>
            ))}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("choose")}>Back</Button>
              <Button onClick={() => setStage("proof")}>I have paid — submit proof</Button>
            </DialogFooter>
          </div>
        )}

        {stage === "proof" && (
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">UTR / UPI reference *</Label>
              <Input value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. UTR1234567890" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Paid at</Label>
                <Input type="datetime-local" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Your bank (optional)</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="HDFC / ICICI / …" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Proof screenshot (optional but recommended)</Label>
              <label className="flex items-center gap-2 rounded border border-dashed border-border/60 p-3 text-xs cursor-pointer hover:border-border">
                <Upload className="w-3.5 h-3.5" />
                <span>{file ? file.name : "Choose file (image / PDF)"}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div>
              <Label className="text-xs">Remarks (optional)</Label>
              <Textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("instructions")} disabled={busy}>Back</Button>
              <Button onClick={submitProof} disabled={busy}>
                {busy && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />} Submit for review
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <div className="font-semibold mb-1">
                {rail === "invoice_offline" ? "Invoice request received" : "Proof submitted"}
              </div>
              <div className="text-sm text-muted-foreground">
                {rail === "invoice_offline"
                  ? "Our team will email the invoice shortly. Storage activates after payment is settled."
                  : "Finance will verify within 1 business day. You'll get a notification on approval."}
              </div>
            </div>
            <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Audit-logged · Order id: <span className="font-mono">{orderId?.slice(0, 8)}…</span>
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-mono break-all text-right">
        {value} {copyable && <CopyBtn value={value} />}
      </span>
    </div>
  );
}
