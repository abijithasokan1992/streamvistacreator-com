import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, FileText, Plus, RefreshCw, CheckCircle2, X, Send, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type LineItem = { label: string; description?: string; quantity: number; unit_paise: number };
type MI = {
  id: string;
  invoice_number: string;
  document_type: "quote" | "invoice";
  status: string;
  user_id: string;
  surface: string;
  support_request_id: string | null;
  line_items: LineItem[];
  subtotal_paise: number;
  gst_percent: number;
  gst_paise: number;
  total_paise: number;
  tax_inclusive: boolean;
  due_date: string | null;
  notes: string | null;
  billed_to_email: string | null;
  billed_to_name: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_link_url: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const inr = (p: number) =>
  "₹" + (Number(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUSES = ["draft", "issued", "overdue", "paid", "void", "cancelled"];

export default function ManualInvoiceConsole() {
  const [rows, setRows] = useState<MI[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("issued");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MI | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("manual_invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as MI[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter(r => tab === "all" || r.status === tab), [rows, tab]);

  const totals = useMemo(() => {
    const sum = (s: string) => rows.filter(r => r.status === s).reduce((a, b) => a + Number(b.total_paise), 0);
    return {
      paid: sum("paid"),
      outstanding: sum("issued") + sum("overdue"),
      draft: sum("draft"),
    };
  }, [rows]);

  const issue = async (id: string) => {
    const { error } = await (supabase as any).rpc("admin_issue_manual_invoice", { _invoice_id: id });
    if (error) return toast.error(error.message);
    toast.success("Issued");
    load();
  };

  const markPaid = async (r: MI) => {
    const method = window.prompt("Payment method (razorpay_link / manual_bank / offline / waived):", r.payment_method || "manual_bank");
    if (!method) return;
    const ref = window.prompt("Payment reference (txn / UTR / link id):", r.payment_reference || "") || null;
    const { error } = await (supabase as any).rpc("admin_mark_invoice_paid", {
      _invoice_id: r.id, _payment_method: method, _payment_reference: ref,
    });
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    load();
  };

  const voidIt = async (id: string) => {
    const reason = window.prompt("Void reason (optional):") || null;
    const { error } = await (supabase as any).rpc("admin_void_manual_invoice", { _invoice_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Voided");
    load();
  };

  const sweepOverdue = async () => {
    const { data, error } = await (supabase as any).rpc("sweep_manual_invoices_overdue");
    if (error) return toast.error(error.message);
    toast.success(`Marked ${data ?? 0} overdue`);
    load();
  };

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <h3 className="font-display text-lg font-bold">Founder-assisted Invoices</h3>
          <span className="text-xs text-muted-foreground">
            Manual quotes & invoices for plans, services, and custom commercial work.
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={sweepOverdue}>Run overdue sweep</Button>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
          <Button size="sm" onClick={() => { setEditing(null); setCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New invoice / quote
          </Button>
        </div>
      </header>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Collected (paid)" value={inr(totals.paid)} tone="emerald" />
        <Stat label="Outstanding" value={inr(totals.outstanding)} tone="amber" />
        <Stat label="In draft" value={inr(totals.draft)} tone="muted" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1">
          {["all", ...STATUSES].map(s => (
            <TabsTrigger key={s} value={s} className="text-xs capitalize">{s}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          {loading ? (
            <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No documents in this state.</div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left p-2 font-medium">Document</th>
                    <th className="text-left p-2 font-medium">Billed to</th>
                    <th className="text-left p-2 font-medium">Surface</th>
                    <th className="text-right p-2 font-medium">Total</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Due</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30">
                      <td className="p-2">
                        <div className="font-mono text-xs">{r.invoice_number}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">{r.document_type}</div>
                      </td>
                      <td className="p-2 text-xs">
                        <div>{r.billed_to_email ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{r.billed_to_name ?? ""}</div>
                      </td>
                      <td className="p-2 text-xs capitalize">{r.surface}</td>
                      <td className="p-2 text-right font-mono font-semibold">{inr(r.total_paise)}</td>
                      <td className="p-2">
                        <StatusBadge s={r.status} />
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-end">
                          {r.status === "draft" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setCreateOpen(true); }} title="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => issue(r.id)} title="Issue"><Send className="w-3.5 h-3.5" /></Button>
                            </>
                          )}
                          {["issued", "overdue", "draft"].includes(r.status) && (
                            <Button size="sm" variant="ghost" onClick={() => markPaid(r)} title="Mark paid"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></Button>
                          )}
                          {r.status !== "paid" && r.status !== "void" && (
                            <Button size="sm" variant="ghost" onClick={() => voidIt(r.id)} title="Void"><X className="w-3.5 h-3.5 text-rose-600" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InvoiceEditor
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        onSaved={() => { setCreateOpen(false); setEditing(null); load(); }}
      />
    </section>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls =
    s === "paid" ? "bg-emerald-500/15 text-emerald-600" :
    s === "issued" ? "bg-sky-500/15 text-sky-600" :
    s === "overdue" ? "bg-amber-500/15 text-amber-600" :
    s === "draft" ? "bg-muted text-muted-foreground" :
    "bg-rose-500/15 text-rose-600";
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${cls}`}>{s}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "muted" }) {
  const c = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl mt-1 ${c}`}>{value}</div>
    </div>
  );
}

function InvoiceEditor({
  open, onOpenChange, editing, onSaved, presetUserId, presetRequestId, presetSurface,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: MI | null;
  onSaved: () => void;
  presetUserId?: string;
  presetRequestId?: string;
  presetSurface?: string;
}) {
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [surface, setSurface] = useState<string>("creator");
  const [docType, setDocType] = useState<"invoice" | "quote">("invoice");
  const [gst, setGst] = useState<number>(18);
  const [taxInc, setTaxInc] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentLink, setPaymentLink] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ label: "", quantity: 1, unit_paise: 0 }]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setUserId(editing.user_id);
      setUserEmail(editing.billed_to_email ?? "");
      setSurface(editing.surface);
      setDocType(editing.document_type);
      setGst(Number(editing.gst_percent));
      setTaxInc(editing.tax_inclusive);
      setDueDate(editing.due_date ?? "");
      setNotes(editing.notes ?? "");
      setPaymentMethod(editing.payment_method ?? "");
      setPaymentLink(editing.payment_link_url ?? "");
      setItems(editing.line_items?.length ? editing.line_items : [{ label: "", quantity: 1, unit_paise: 0 }]);
    } else {
      setUserId(presetUserId ?? "");
      setUserEmail("");
      setSurface(presetSurface ?? "creator");
      setDocType("invoice");
      setGst(18); setTaxInc(false); setDueDate(""); setNotes("");
      setPaymentMethod(""); setPaymentLink("");
      setItems([{ label: "", quantity: 1, unit_paise: 0 }]);
    }
  }, [open, editing, presetUserId, presetSurface]);

  const subtotal = items.reduce((a, b) => a + (Number(b.quantity) || 0) * (Number(b.unit_paise) || 0), 0);
  const gstAmt = taxInc ? Math.round(subtotal - subtotal / (1 + gst / 100)) : Math.round(subtotal * gst / 100);
  const total = taxInc ? subtotal : subtotal + gstAmt;

  const resolveUser = async () => {
    if (userId) return userId;
    toast.error("Paste the customer's user UUID (visible in the request / admin user table).");
    return null;
  };

  const save = async () => {
    if (!items.some(i => i.label && i.unit_paise > 0)) { toast.error("Add at least one priced line item"); return; }
    const cleanItems = items.filter(i => i.label.trim()).map(i => ({
      label: i.label.trim(), description: i.description ?? undefined,
      quantity: Number(i.quantity) || 1, unit_paise: Math.round(Number(i.unit_paise) || 0),
    }));

    if (editing) {
      const { error } = await (supabase as any).rpc("admin_update_manual_invoice", {
        _invoice_id: editing.id, _line_items: cleanItems, _gst_percent: gst, _tax_inclusive: taxInc,
        _due_date: dueDate || null, _notes: notes || null,
        _payment_method: paymentMethod || null, _payment_link_url: paymentLink || null,
      });
      if (error) return toast.error(error.message);
      toast.success("Updated"); onSaved(); return;
    }

    let uid = userId;
    if (!uid) {
      const r = await resolveUser();
      if (!r) return;
      uid = r;
    }
    const { error } = await (supabase as any).rpc("admin_create_manual_invoice", {
      _user_id: uid, _support_request_id: presetRequestId ?? null,
      _document_type: docType, _surface: surface, _line_items: cleanItems,
      _gst_percent: gst, _tax_inclusive: taxInc, _due_date: dueDate || null, _notes: notes || null,
      _payment_method: paymentMethod || null, _payment_link_url: paymentLink || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Draft created"); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.invoice_number}` : "New invoice / quote"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Customer email</Label>
                <Input value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="user@example.com" disabled={!!presetUserId} />
              </div>
              <div>
                <Label className="text-xs">…or user UUID</Label>
                <Input value={userId} onChange={e => setUserId(e.target.value)} placeholder="00000000-…" disabled={!!presetUserId} />
              </div>
              <div>
                <Label className="text-xs">Surface</Label>
                <Select value={surface} onValueChange={setSurface}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Document type</Label>
                <Select value={docType} onValueChange={(v) => setDocType(v as "invoice" | "quote")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Line items</Label>
            <div className="space-y-2 mt-1">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-5" placeholder="Label (e.g. Creator Pro plan – monthly)" value={it.label}
                    onChange={e => setItems(arr => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.quantity}
                    onChange={e => setItems(arr => arr.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <Input className="col-span-4" type="number" placeholder="Unit (paise, e.g. 99900 = ₹999)"
                    value={it.unit_paise}
                    onChange={e => setItems(arr => arr.map((x, j) => j === i ? { ...x, unit_paise: Number(e.target.value) } : x))} />
                  <Button className="col-span-1" size="sm" variant="ghost"
                    onClick={() => setItems(arr => arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setItems(arr => [...arr, { label: "", quantity: 1, unit_paise: 0 }])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add line
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">GST %</Label>
              <Input type="number" value={gst} onChange={e => setGst(Number(e.target.value))} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input id="taxInc" type="checkbox" checked={taxInc} onChange={e => setTaxInc(e.target.checked)} />
              <Label htmlFor="taxInc" className="text-xs">Tax-inclusive total</Label>
            </div>
            <div>
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payment method</Label>
              <Select value={paymentMethod || "none"} onValueChange={v => setPaymentMethod(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None yet —</SelectItem>
                  <SelectItem value="razorpay_link">Razorpay Payment Link</SelectItem>
                  <SelectItem value="manual_bank">Manual bank transfer</SelectItem>
                  <SelectItem value="offline">Offline / cash</SelectItem>
                  <SelectItem value="waived">Waived</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment link URL (optional)</Label>
              <Input value={paymentLink} onChange={e => setPaymentLink(e.target.value)} placeholder="https://rzp.io/i/…" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Internal / customer-visible notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="rounded-lg bg-secondary/30 p-3 grid grid-cols-3 gap-2 text-xs">
            <div>Subtotal: <strong className="font-mono">{inr(taxInc ? subtotal - gstAmt : subtotal)}</strong></div>
            <div>GST ({gst}%): <strong className="font-mono">{inr(gstAmt)}</strong></div>
            <div>Total: <strong className="font-mono">{inr(total)}</strong></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Save changes" : "Save as draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { InvoiceEditor };
