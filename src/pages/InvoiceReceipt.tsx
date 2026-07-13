import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Invoice {
  id: string;
  invoice_number: string;
  description: string;
  currency: string;
  subtotal_paise: number;
  gst_percent: number;
  gst_paise: number;
  total_paise: number;
  status: string;
  source: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  billed_to_email: string | null;
  billed_to_name: string | null;
  issued_at: string;
}

const inr = (paise: number) =>
  "₹" + (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceReceipt() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) setDenied(true);
      else setInv(data as Invoice);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-dvh grid place-items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (denied || !inv) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => history.back()}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <Button onClick={() => window.print()} className="bg-foreground text-background hover:bg-foreground/90">
            <Printer className="w-4 h-4 mr-2" /> Download PDF / Print
          </Button>
        </div>

        <div className="bg-background border rounded-2xl p-8 shadow-sm print:shadow-none print:border-0 print:rounded-none">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-mono mb-1">
                StreamVista · Tax Invoice
              </div>
              <div className="font-display text-2xl font-bold">Payment Receipt</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-muted-foreground uppercase tracking-wider">Invoice</div>
              <div className="font-mono font-semibold text-base text-foreground">{inv.invoice_number}</div>
              <div className="text-muted-foreground mt-2 uppercase tracking-wider">Date</div>
              <div className="font-mono">{new Date(inv.issued_at).toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Billed to</div>
              <div className="font-medium">{inv.billed_to_name || inv.billed_to_email || "—"}</div>
              {inv.billed_to_email && <div className="text-muted-foreground text-xs">{inv.billed_to_email}</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payment</div>
              <div className="text-xs font-mono text-muted-foreground">
                Order: {inv.razorpay_order_id ?? "—"}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                Payment: {inv.razorpay_payment_id ?? "—"}
              </div>
            </div>
          </div>

          <div className="border-t border-b py-4 my-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <div className="font-medium">{inv.description}</div>
                <div className="text-xs text-muted-foreground mt-1 capitalize">
                  Source: {inv.source.replace("_", " ")}
                </div>
              </div>
              <div className="text-right font-mono text-sm shrink-0">{inr(inv.subtotal_paise)}</div>
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={inr(inv.subtotal_paise)} />
            <Row label={`GST (${Number(inv.gst_percent)}%)`} value={inr(inv.gst_paise)} />
            <div className="border-t pt-3 mt-3 flex items-center justify-between">
              <div className="font-display font-bold">Total paid</div>
              <div className="font-display font-bold text-xl">{inr(inv.total_paise)}</div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground leading-relaxed">
            <div className="uppercase tracking-wider text-foreground/70 font-mono mb-1">
              Status: <span className="text-emerald-600">{inv.status.toUpperCase()}</span>
            </div>
            This invoice is a tax invoice issued by StreamVista. Keep it for your records.
            For questions about this receipt, contact support@streamvista.in.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
