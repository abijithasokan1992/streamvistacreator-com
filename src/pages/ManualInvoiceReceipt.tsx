import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type LineItem = { label: string; description?: string; quantity: number; unit_paise: number };
type MI = {
  id: string;
  invoice_number: string;
  document_type: string;
  status: string;
  user_id: string;
  surface: string;
  line_items: LineItem[];
  subtotal_paise: number;
  gst_percent: number;
  gst_paise: number;
  total_paise: number;
  tax_inclusive: boolean;
  currency: string;
  due_date: string | null;
  notes: string | null;
  billed_to_name: string | null;
  billed_to_email: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_link_url: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const inr = (p: number) => "₹" + (Number(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ManualInvoiceReceipt() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<MI | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).from("manual_invoices").select("*").eq("id", id).maybeSingle();
      if (error || !data) setDenied(true);
      else setInv(data as MI);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  if (denied || !inv) return <Navigate to="/" replace />;

  const subtotalDisplay = inv.tax_inclusive ? (Number(inv.subtotal_paise)) : Number(inv.subtotal_paise);

  return (
    <div className="min-h-screen bg-secondary/10 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <Button variant="ghost" size="sm" asChild><a href="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back</a></Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print / Save PDF</Button>
        </div>

        <div className="bg-card border border-border/40 rounded-2xl p-8 print:border-0 print:rounded-none print:shadow-none">
          <header className="flex justify-between items-start pb-6 border-b border-border/40">
            <div>
              <div className="font-display text-2xl font-bold">StreamVista</div>
              <div className="text-xs text-muted-foreground mt-1">Founder-assisted commercial document</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{inv.document_type}</div>
              <div className="font-mono text-lg">{inv.invoice_number}</div>
              <div className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                inv.status === "paid" ? "bg-emerald-500/15 text-emerald-600" :
                inv.status === "overdue" ? "bg-amber-500/15 text-amber-600" :
                inv.status === "void" ? "bg-rose-500/15 text-rose-600" :
                "bg-sky-500/15 text-sky-600"
              }`}>{inv.status}</div>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-6 py-6 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Billed to</div>
              <div className="mt-1">{inv.billed_to_name ?? "—"}</div>
              <div className="text-muted-foreground">{inv.billed_to_email ?? ""}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Issued {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : "—"}</div>
              {inv.due_date && <div className="text-xs text-muted-foreground">Due {new Date(inv.due_date).toLocaleDateString()}</div>}
              {inv.paid_at && <div className="text-xs text-emerald-600">Paid {new Date(inv.paid_at).toLocaleDateString()}</div>}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="text-left py-2 font-medium">Item</th>
                <th className="text-right py-2 font-medium">Qty</th>
                <th className="text-right py-2 font-medium">Unit</th>
                <th className="text-right py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(inv.line_items ?? []).map((li, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td className="py-2">
                    <div>{li.label}</div>
                    {li.description && <div className="text-xs text-muted-foreground">{li.description}</div>}
                  </td>
                  <td className="text-right py-2 font-mono">{li.quantity}</td>
                  <td className="text-right py-2 font-mono">{inr(li.unit_paise)}</td>
                  <td className="text-right py-2 font-mono">{inr(li.quantity * li.unit_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{inr(subtotalDisplay)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST ({inv.gst_percent}%)</span><span className="font-mono">{inr(inv.gst_paise)}</span></div>
              <div className="flex justify-between border-t border-border/40 pt-1 font-bold"><span>Total</span><span className="font-mono">{inr(inv.total_paise)}</span></div>
            </div>
          </div>

          {(inv.payment_link_url || inv.payment_method || inv.payment_reference) && (
            <div className="mt-6 rounded-lg bg-secondary/30 p-4 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Payment</div>
              {inv.payment_method && <div>Method: {inv.payment_method}</div>}
              {inv.payment_link_url && inv.status !== "paid" && (
                <div>Pay online: <a className="text-accent underline" href={inv.payment_link_url} target="_blank" rel="noreferrer">{inv.payment_link_url}</a></div>
              )}
              {inv.payment_reference && <div className="text-xs text-muted-foreground">Reference: {inv.payment_reference}</div>}
            </div>
          )}

          {inv.notes && (
            <div className="mt-6 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/40 pt-3">
              <div className="uppercase tracking-wider text-[10px] mb-1">Notes</div>
              {inv.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
