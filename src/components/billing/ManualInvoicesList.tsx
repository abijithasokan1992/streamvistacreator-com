import { useEffect, useState } from "react";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  invoice_number: string;
  document_type: string;
  status: string;
  total_paise: number;
  due_date: string | null;
  payment_link_url: string | null;
  issued_at: string | null;
  notes: string | null;
};

const inr = (p: number) => "₹" + (Number(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-600",
  issued: "bg-sky-500/15 text-sky-600",
  overdue: "bg-amber-500/15 text-amber-600",
  void: "bg-rose-500/15 text-rose-600",
};

export default function ManualInvoicesList({ surface }: { surface?: "creator" | "studio" }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      let q = (supabase as any)
        .from("manual_invoices")
        .select("id,invoice_number,document_type,status,total_paise,due_date,payment_link_url,issued_at,notes,surface")
        .eq("user_id", user.id)
        .in("status", ["issued", "overdue", "paid", "void"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (surface) q = q.eq("surface", surface);
      const { data } = await q;
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [surface]);

  if (loading) {
    return <div className="py-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/10 p-4 text-sm text-muted-foreground">
        No founder-assisted invoices yet. Anything custom (plan upgrade, service work, allocations) will appear here once issued.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/40">
      {rows.map(r => (
        <div key={r.id} className="p-3 flex flex-wrap items-center gap-3 justify-between text-sm">
          <div className="min-w-0 flex items-start gap-2">
            <FileText className="w-4 h-4 text-accent mt-0.5" />
            <div className="min-w-0">
              <div className="font-medium truncate">{r.invoice_number} <span className="text-[10px] uppercase text-muted-foreground ml-1">{r.document_type}</span></div>
              <div className="text-[11px] text-muted-foreground">
                {r.issued_at ? `Issued ${new Date(r.issued_at).toLocaleDateString()}` : "Pending issue"}
                {r.due_date && ` · Due ${new Date(r.due_date).toLocaleDateString()}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold">{inr(r.total_paise)}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${STATUS_TONE[r.status] ?? "bg-secondary/40"}`}>{r.status}</span>
            {r.payment_link_url && r.status !== "paid" && (
              <a className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                 href={r.payment_link_url} target="_blank" rel="noreferrer">
                Pay <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <a className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
               href={`/invoice/manual/${r.id}`} target="_blank" rel="noreferrer">
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
