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

const formatMoney = (minorUnits: number, currency: string | null | undefined) => {
  const code = (currency || "INR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(minorUnits) / 100);
  } catch {
    return `${code} ${(Number(minorUnits) / 100).toFixed(2)}`;
  }
};

const PAID_STATES = new Set(["paid", "succeeded", "captured"]);

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

  const normalizedStatus = String(inv.status || "pending").toLowerCase();
  const isPaid = PAID_STATES.has(normalizedStatus);
  const statusClass = isPaid
    ? "text-emerald-600"
    : normalizedStatus === "failed"
      ? "text-red-600"
      : "text-amber-600";

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
              <div className="font-display text-2xl font-bold">{isPaid ? "Payment Receipt" : "Invoice"}</div>
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
                  Source: {inv.source.replace(/_/g, " ")}
                </div>
              </div>
              <div className="text-right font-mono text-sm shrink-0">{formatMoney(inv.subtotal_paise, inv.currency)}</div>
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMoney(inv.subtotal_paise, inv.currency)} />
            <Row label={`GST (${Number(inv.gst_percent)}%)`} value={formatMoney(inv.gst_paise, inv.currency)} />
            <div className="border-t pt-3 mt-3 flex items-center justify-between">
              <div className="font-display font-bold">{isPaid ? "Total paid" : "Total due"}</div>
              <div className="font-display font-bold text-xl">{formatMoney(inv.total_paise, inv.currency)}</div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground leading-relaxed">
            <div className="uppercase tracking-wider text-foreground/70 font-mono mb-1">
              Status: <span className={statusClass}>{normalizedStatus.replace(/_/g, " ").toUpperCase()}</span>
            </div>
            {isPaid
              ? "This tax invoice records a completed payment. Keep it for your records."
              : "This invoice does not record a completed payment yet. Check the status before treating it as paid."}
            {" "}For questions about this invoice, contact support@streamvista.in.
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
