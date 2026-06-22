import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Crown, HardDrive, Receipt, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import StorageGrantPanel from "@/components/admin/StorageGrantPanel";

export type EntitlementTarget = {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
};

const inr = (paise: number) =>
  "₹" + (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtGb = (n: number) => n >= 1024 ? `${(n / 1024).toFixed(2)} TB` : `${n} GB`;

const STATUS_TONE: Record<string, string> = {
  paid:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  failed:    "bg-rose-500/15 text-rose-300 border-rose-500/30",
  abandoned: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  refunded:  "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export default function UserEntitlementDrillIn({
  target, open, onOpenChange,
}: {
  target: EntitlementTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [grantGb, setGrantGb] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [granting, setGranting] = useState(false);

  const reload = async (userId: string) => {
    setLoading(true);
    const [pa, alloc, tu, inv, prof] = await Promise.all([
      (supabase as any).from("plan_assignments")
        .select("id,status,starts_at,ends_at,is_lifetime,notes,plan:plans(name,code,storage_gb,price_amount,billing_cycle)")
        .eq("user_id", userId).order("created_at", { ascending: false }),
      (supabase as any).from("storage_allocations")
        .select("id,allocated_gb,used_gb,source,notes,created_at,granted_by")
        .eq("user_id", userId).order("created_at", { ascending: false }),
      (supabase as any).from("storage_topups")
        .select("id,tb_added,amount_inr,status,created_at,razorpay_order_id,razorpay_payment_id,notes")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      (supabase as any).from("invoices")
        .select("id,invoice_number,description,total_paise,status,issued_at,source")
        .eq("user_id", userId).order("issued_at", { ascending: false }).limit(20),
      (supabase as any).from("user_profiles")
        .select("plan_tier, topup_tb, storage_used_mb")
        .eq("user_id", userId).maybeSingle(),
    ]);
    setAssignments(pa.data ?? []);
    setAllocations(alloc.data ?? []);
    setTopups(tu.data ?? []);
    setInvoices(inv.data ?? []);
    setProfile(prof.data);
    setLoading(false);
  };

  useEffect(() => {
    if (open && target?.user_id) {
      setGrantGb(""); setGrantNote("");
      reload(target.user_id);
    }
  }, [open, target?.user_id]);

  const totalAllocatedGb = allocations.reduce((s, a) => s + Number(a.allocated_gb || 0), 0);
  const totalUsedGb = allocations.reduce((s, a) => s + Number(a.used_gb || 0), 0);
  const activePlan = assignments.find((a) => a.status === "active") ?? assignments[0];
  const latestInvoice = invoices[0];

  const onGrant = async () => {
    if (!target?.user_id) return;
    const gb = Number(grantGb);
    if (!gb || gb <= 0 || !Number.isFinite(gb)) {
      toast.error("Enter a positive GB amount."); return;
    }
    setGranting(true);
    try {
      const { error } = await (supabase as any).rpc("admin_grant_storage", {
        _user_id: target.user_id,
        _gb: Math.floor(gb),
        _note: grantNote || null,
      });
      if (error) throw error;
      toast.success(`Granted ${Math.floor(gb)} GB.`);
      setGrantGb(""); setGrantNote("");
      await reload(target.user_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grant failed.");
    } finally { setGranting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Entitlement · {target?.display_name || target?.email || target?.user_id}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="py-20 grid place-items-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Plan + Storage summary */}
            <div className="grid grid-cols-2 gap-3">
              <Tile icon={<Crown className="w-4 h-4 text-accent" />} label="Active plan"
                value={activePlan?.plan?.name || profile?.plan_tier || "Free"}
                sub={activePlan?.status ? `Status: ${activePlan.status}` : undefined}
              />
              <Tile icon={<HardDrive className="w-4 h-4 text-accent" />} label="Storage"
                value={`${fmtGb(totalUsedGb)} / ${fmtGb(totalAllocatedGb || 50)}`}
                sub={`${allocations.length} allocation${allocations.length === 1 ? "" : "s"} · legacy ${profile?.topup_tb || 0} TB`}
              />
              <Tile icon={<ShoppingCart className="w-4 h-4 text-accent" />} label="Top-ups"
                value={`${topups.length} record${topups.length === 1 ? "" : "s"}`}
                sub={`${topups.filter(t => t.status === "paid").length} paid · ${topups.filter(t => t.status === "pending").length} pending · ${topups.filter(t => t.status === "abandoned").length} abandoned`}
              />
              <Tile icon={<Receipt className="w-4 h-4 text-accent" />} label="Latest invoice"
                value={latestInvoice ? latestInvoice.invoice_number : "—"}
                sub={latestInvoice ? `${inr(latestInvoice.total_paise)} · ${latestInvoice.status}` : undefined}
              />
            </div>

            {/* Grant storage */}
            <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold">Grant storage</h3>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Writes to <code>storage_allocations</code> with source=admin_grant.
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <Label htmlFor="grant-gb" className="text-xs">Amount (GB)</Label>
                  <Input id="grant-gb" type="number" min={1} value={grantGb}
                    onChange={(e) => setGrantGb(e.target.value)} placeholder="e.g. 500" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="grant-note" className="text-xs">Note (optional)</Label>
                  <Input id="grant-note" value={grantNote}
                    onChange={(e) => setGrantNote(e.target.value)} placeholder="reason / ticket id" />
                </div>
              </div>
              <Button size="sm" onClick={onGrant} disabled={granting || !grantGb}>
                {granting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Grant storage
              </Button>
            </section>

            {/* Allocations */}
            <Section title="Storage allocations">
              {allocations.length === 0
                ? <Empty>No canonical allocations yet.</Empty>
                : (
                  <Table head={["Source", "Allocated", "Used", "Created", "Notes"]}>
                    {allocations.map((a) => (
                      <tr key={a.id} className="border-t border-border/30">
                        <td className="px-3 py-2 text-xs capitalize">{a.source}</td>
                        <td className="px-3 py-2 font-mono">{fmtGb(a.allocated_gb)}</td>
                        <td className="px-3 py-2 font-mono">{fmtGb(a.used_gb)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{a.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </Table>
                )}
            </Section>

            {/* Top-ups */}
            <Section title="Top-up history">
              {topups.length === 0
                ? <Empty>No top-ups recorded.</Empty>
                : (
                  <Table head={["Date", "Storage", "Amount", "Status", "Order"]}>
                    {topups.map((t) => (
                      <tr key={t.id} className="border-t border-border/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{t.tb_added != null ? `${t.tb_added} TB` : "—"}</td>
                        <td className="px-3 py-2 font-mono">{t.amount_inr != null ? `₹${Number(t.amount_inr).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${STATUS_TONE[t.status ?? ""] ?? "bg-muted text-muted-foreground border-border"}`}>
                            {t.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">{t.razorpay_order_id ?? "—"}</td>
                      </tr>
                    ))}
                  </Table>
                )}
            </Section>

            {/* Invoices */}
            <Section title="Invoices">
              {invoices.length === 0
                ? <Empty>No invoices issued.</Empty>
                : (
                  <Table head={["Number", "Description", "Total", "Status", "Issued", ""]}>
                    {invoices.map((i) => (
                      <tr key={i.id} className="border-t border-border/30">
                        <td className="px-3 py-2 font-mono text-xs">{i.invoice_number}</td>
                        <td className="px-3 py-2 text-xs truncate max-w-[260px]">{i.description}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{inr(i.total_paise)}</td>
                        <td className="px-3 py-2 text-xs capitalize">{i.status}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(i.issued_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-right">
                          <a href={`/invoice/${i.id}`} target="_blank" rel="noreferrer"
                             className="text-xs text-accent hover:underline">Receipt</a>
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
            </Section>

            {/* Plan assignments */}
            <Section title="Plan assignments">
              {assignments.length === 0
                ? <Empty>No canonical plan assignments yet.</Empty>
                : (
                  <Table head={["Plan", "Status", "Starts", "Ends", "Notes"]}>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-t border-border/30">
                        <td className="px-3 py-2 text-sm">{a.plan?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-xs capitalize">{a.status}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{a.starts_at ? new Date(a.starts_at).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{a.ends_at ? new Date(a.ends_at).toLocaleDateString() : a.is_lifetime ? "lifetime" : "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{a.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </Table>
                )}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className="font-display text-lg font-bold mt-1.5 truncate" title={value}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="rounded-xl border border-border/40 overflow-hidden">{children}</div>
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground px-3 py-4">{children}</p>;
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/20 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} className="text-left px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
