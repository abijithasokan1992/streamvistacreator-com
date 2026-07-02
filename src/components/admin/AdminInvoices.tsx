import { useEffect, useMemo, useState } from "react";
import { Loader2, FileText, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  source: string;
  description: string;
  subtotal_paise: number;
  gst_paise: number;
  total_paise: number;
  status: string;
  billed_to_email: string | null;
  issued_at: string;
  razorpay_payment_id: string | null;
}

const inr = (paise: number) =>
  "₹" + (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdminInvoices() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id,invoice_number,user_id,source,description,subtotal_paise,gst_paise,total_paise,status,billed_to_email,issued_at,razorpay_payment_id")
        .order("issued_at", { ascending: false })
        .limit(200);
      setRows((data as Invoice[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      r.invoice_number.toLowerCase().includes(s) ||
      (r.billed_to_email ?? "").toLowerCase().includes(s) ||
      (r.razorpay_payment_id ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const totals = useMemo(() => {
    const paidPaise = filtered.filter(r => r.status === "paid").reduce((a, b) => a + Number(b.total_paise), 0);
    return { count: filtered.length, paidPaise };
  }, [filtered]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <h3 className="font-display text-lg font-bold">Invoices</h3>
          <span className="text-xs text-muted-foreground">
            {totals.count} records · {inr(totals.paidPaise)} collected
          </span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice # / email / payment id"
            className="pl-8 h-9 w-72" />
        </div>
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left p-2 font-medium">Invoice</th>
                <th className="text-left p-2 font-medium">Billed to</th>
                <th className="text-left p-2 font-medium">Source</th>
                <th className="text-right p-2 font-medium">Subtotal</th>
                <th className="text-right p-2 font-medium">GST</th>
                <th className="text-right p-2 font-medium">Total</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Issued</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30">
                  <td className="p-2 font-mono text-xs">{r.invoice_number}</td>
                  <td className="p-2 text-xs">{r.billed_to_email ?? "—"}</td>
                  <td className="p-2 text-xs capitalize">{r.source}</td>
                  <td className="p-2 text-right font-mono">{inr(r.subtotal_paise)}</td>
                  <td className="p-2 text-right font-mono">{inr(r.gst_paise)}</td>
                  <td className="p-2 text-right font-mono font-semibold">{inr(r.total_paise)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      r.status === "paid" ? "bg-emerald-500/15 text-emerald-600" :
                      r.status === "refunded" ? "bg-amber-500/15 text-amber-600" :
                      r.status === "void" ? "bg-rose-500/15 text-rose-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{r.status}</span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {new Date(r.issued_at).toLocaleDateString()}
                  </td>
                  <td className="p-2">
                    <Button asChild size="sm" variant="ghost">
                      <a href={`/invoice/${r.id}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
