import { useEffect, useState } from "react";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface Invoice {
  id: string;
  invoice_number: string;
  description: string;
  total_paise: number;
  status: string;
  issued_at: string;
}

const inr = (paise: number) =>
  "₹" + (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CreatorInvoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id,invoice_number,description,total_paise,status,issued_at")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false })
        .limit(50);
      setRows((data as Invoice[]) ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-accent" />
        <h3 className="font-display text-lg font-bold">Invoices & Receipts</h3>
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No invoices yet. Your receipts will appear here after your first payment.
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {rows.map(r => (
            <div key={r.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-muted-foreground">{r.invoice_number}</div>
                <div className="font-medium text-sm truncate">{r.description}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.issued_at).toLocaleDateString()} · <span className="capitalize">{r.status}</span>
                </div>
              </div>
              <div className="font-mono font-semibold">{inr(r.total_paise)}</div>
              <Button asChild size="sm" variant="outline">
                <a href={`/invoice/${r.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Receipt
                </a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
