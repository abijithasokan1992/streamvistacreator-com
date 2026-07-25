import { useMemo, useState, useEffect } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, LayoutDashboard, Film, Users, Wallet, LogOut, ShieldCheck, ArrowUpRight, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OFFICE } from "@/lib/admin/labels";
import { useLiveAdminCounts } from "@/hooks/useLiveAdminCounts";
import { TitleInspectionDrawer } from "@/components/admin/TitleInspectionDrawer";
import { BuyerMappingActionDrawer, type BuyerOffer } from "@/components/admin/BuyerMappingActionDrawer";
import { BuyerOfferAuditLog } from "@/components/admin/BuyerOfferAuditLog";
import AdminErrorBoundary from "@/components/admin/AdminErrorBoundary";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

type Room = "dashboard" | "movies" | "buyers" | "accounts";

const ROOMS: Array<{ id: Room; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = [
  { id: "dashboard", label: OFFICE.dashboard,   icon: LayoutDashboard, desc: "Today's numbers and priorities." },
  { id: "movies",    label: OFFICE.movieDesk,   icon: Film,            desc: "Movie Vault, Quality Check, Legal & Agreements." },
  { id: "buyers",    label: OFFICE.buyerMapping, icon: Users,          desc: "Buyers, offers, active mappings." },
  { id: "accounts",  label: OFFICE.accounts,    icon: Wallet,          desc: "Invoices, royalty and statements." },
];

export default function MediaOfficePage() {
  const { user, isAdmin, isSuperAdmin, isQcReviewer, isLegalReviewer, loading, signOut } = useAuth();
  const canEnter = isAdmin || isSuperAdmin || isQcReviewer || isLegalReviewer;
  const canDecide = isAdmin || isSuperAdmin;
  const [params, setParams] = useSearchParams();
  const room = (params.get("room") as Room) || "dashboard";

  const setRoom = (r: Room) => {
    const next = new URLSearchParams(params);
    next.set("room", r);
    setParams(next, { replace: false });
  };

  if (loading) return <div className="min-h-dvh grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth?next=/admin/office" replace />;
  if (!canEnter) return <Navigate to="/admin" replace />;

  return (
    <AdminErrorBoundary>
      <main className="min-h-dvh bg-background text-foreground">
        <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary grid place-items-center">
                <ShieldCheck className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Media Office</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">StreamVista Distribution</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Full admin <ArrowUpRight className="w-3 h-3" />
              </Link>
              <ThemeToggle />
              <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid md:grid-cols-[220px_1fr] gap-6">
          <aside className="md:sticky md:top-[70px] md:self-start">
            <nav className="rounded-xl border border-border/50 bg-secondary/10 p-2 space-y-0.5">
              {ROOMS.map((r) => {
                const Icon = r.icon;
                const active = room === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRoom(r.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                      active
                        ? "bg-accent/[0.07] text-foreground ring-1 ring-inset ring-accent/20"
                        : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{r.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            {room === "dashboard" && <DashboardRoom onOpenMovies={() => setRoom("movies")} />}
            {room === "movies"    && <MoviesRoom canDecide={canDecide} />}
            {room === "buyers"    && <BuyersRoom />}
            {room === "accounts"  && <AccountsRoom />}
          </section>
        </div>
      </main>
    </AdminErrorBoundary>
  );
}

/* -------------------- Dashboard -------------------- */

function LiveDot({ live }: { live: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider",
      live ? "text-emerald-500" : "text-muted-foreground")}>
      <span className={cn("w-1.5 h-1.5 rounded-full", live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40")} />
      {live ? "Live" : "Offline"}
    </span>
  );
}

function CounterCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold tabular-nums">{value.toLocaleString("en-IN")}</div>
    </div>
  );
}

function DashboardRoom({ onOpenMovies }: { onOpenMovies: () => void }) {
  const { counts, live, syncStatus, syncError, updatedAt, error, refresh, reconnect } = useLiveAdminCounts();
  const [reconnecting, setReconnecting] = useState(false);
  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await reconnect();
      toast.success("Reconnecting live sync…");
    } finally {
      setTimeout(() => setReconnecting(false), 800);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Today</p>
          <h1 className="font-display text-2xl md:text-3xl mt-1">Media Office Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything that needs a decision, live from the desk.</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot live={live} />
          <button onClick={refresh} className="text-xs text-muted-foreground hover:text-foreground">Refresh</button>
        </div>
      </div>

      {syncStatus === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-destructive/15 grid place-items-center shrink-0">
            <WifiOff className="w-4 h-4 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Live sync interrupted</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {syncError ?? "The database connection dropped."} Numbers below are the last known values —
              they will not update until you reconnect.
            </p>
          </div>
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", reconnecting && "animate-spin")} />
            {reconnecting ? "Reconnecting…" : "Retry sync"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Couldn't refresh some numbers — showing the last known values. {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CounterCard label={OFFICE.countAwaitingQc}     value={counts.awaitingQc} />
        <CounterCard label={OFFICE.countAwaitingLegal}  value={counts.awaitingLegal} />
        <CounterCard label={OFFICE.countDrafts}         value={counts.drafts} />
        <CounterCard label={OFFICE.countSubmitted}      value={counts.submitted} />
        <CounterCard label={OFFICE.countApproved}       value={counts.approved} />
        <CounterCard label={OFFICE.countPublished}      value={counts.published} />
        <CounterCard label={OFFICE.countOpenOffers}     value={counts.openOffers} />
        <CounterCard label={OFFICE.countActiveMappings} value={counts.activeMappings} />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Move the queue forward</h3>
          <p className="text-sm text-muted-foreground">Open the Movie Desk to approve, send back, or mark titles ready.</p>
        </div>
        <button onClick={onOpenMovies} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
          Open Movie Desk
        </button>
      </div>

      {updatedAt && (
        <p className="text-[10px] text-muted-foreground/70">Last updated {new Date(updatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}

/* -------------------- Movies -------------------- */

type MovieRow = {
  id: string;
  title: string | null;
  status: string | null;
  qc_status: string | null;
  legal_clearance: string | null;
  updated_at: string;
};

type Bucket = "waiting_qc" | "waiting_legal" | "drafts" | "submitted" | "approved";

const BUCKETS: Array<{ id: Bucket; label: string }> = [
  { id: "submitted",     label: "New submissions" },
  { id: "waiting_qc",    label: OFFICE.countAwaitingQc },
  { id: "waiting_legal", label: OFFICE.countAwaitingLegal },
  { id: "approved",      label: OFFICE.countApproved },
  { id: "drafts",        label: OFFICE.countDrafts },
];

function MoviesRoom({ canDecide }: { canDecide: boolean }) {
  const [bucket, setBucket] = useState<Bucket>("submitted");
  const [rows, setRows] = useState<MovieRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from("content_titles")
        .select("id,title,status,qc_status,legal_clearance,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (bucket === "submitted") q = q.eq("status", "submitted");
      if (bucket === "drafts") q = q.eq("status", "draft");
      if (bucket === "approved") q = q.eq("status", "approved");
      if (bucket === "waiting_qc") q = q.eq("qc_status", "pending");
      if (bucket === "waiting_legal") q = q.eq("legal_clearance", "pending");
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as MovieRow[]) ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't load movies.");
      toast.error("Couldn't load movies. Showing previous list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bucket]);

  // Live-refresh the current bucket whenever titles change.
  useEffect(() => {
    const ch = supabase
      .channel(`movie-desk-${bucket}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "content_titles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [bucket]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{OFFICE.movieDesk}</p>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Movies on the desk</h1>
        <p className="text-sm text-muted-foreground mt-1">Click any movie to preview it and take a decision.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBucket(b.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs border transition-colors",
              bucket === b.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-card">
        {loading && rows.length === 0 ? (
          <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nothing in this queue right now.</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => { setOpenId(r.id); setDrawerOpen(true); }}
                  className="w-full text-left px-4 py-3 hover:bg-secondary/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title ?? "Untitled"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Status: {r.status ?? "—"} · QC: {r.qc_status ?? "—"} · Legal: {r.legal_clearance ?? "—"}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TitleInspectionDrawer
        titleId={openId}
        open={drawerOpen}
        onOpenChange={(v) => { setDrawerOpen(v); if (!v) setOpenId(null); }}
        canDecide={canDecide}
      />
    </div>
  );
}

/* -------------------- Buyers -------------------- */

function BuyersRoom() {
  const [rows, setRows] = useState<BuyerOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<BuyerOffer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | "approve" | "sendback">(null);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("distribution_program_offers")
        .select("id,program_name,status,term_years,term_start_date,term_end_date,updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows((data as BuyerOffer[]) ?? []); setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't load buyer offers.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("buyers-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "distribution_program_offers" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const patchRow = (next: BuyerOffer) => {
    setRows((prev) => prev.map((r) => (r.id === next.id ? { ...r, ...next } : r)));
    setSelected((cur) => (cur && cur.id === next.id ? { ...cur, ...next } : cur));
  };

  const toggleOne = (id: string) => {
    setChecked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Only "offered" offers can be approved (→accepted); only "draft"/"offered"
  // can be sent back (→cancelled with reason). Silently skip incompatible rows
  // and surface a per-row toast so admins see exactly what happened.
  const eligibleFor = (action: "approve" | "sendback", status: string) => {
    if (action === "approve") return status === "offered";
    return status === "draft" || status === "offered";
  };

  const runBulk = async (action: "approve" | "sendback", reason?: string) => {
    const targets = rows.filter((r) => checked.has(r.id));
    if (targets.length === 0) { toast.error("Select at least one offer"); return; }
    setBulkBusy(action);
    let ok = 0, skipped = 0, failed = 0;
    const outcomes: Array<{ id: string; name: string; result: "ok" | "skipped" | "failed"; note?: string }> = [];
    for (const r of targets) {
      const label = r.program_name || r.id.slice(0, 8);
      if (!eligibleFor(action, r.status)) {
        skipped++;
        outcomes.push({ id: r.id, name: label, result: "skipped", note: `status=${r.status}` });
        toast.message(`Skipped: ${label}`, {
          description: `Cannot ${action === "approve" ? "approve" : "send back"} an offer in "${r.status}".`,
        });
        continue;
      }
      try {
        const nowIso = new Date().toISOString();
        const patch: any = action === "approve"
          ? { status: "accepted", accepted_at: nowIso }
          : { status: "cancelled", legal_text_snapshot: reason };
        const { error } = await supabase
          .from("distribution_program_offers")
          .update(patch)
          .eq("id", r.id);
        if (error) throw error;
        patchRow({ ...r, status: patch.status, updated_at: nowIso });
        ok++;
        outcomes.push({ id: r.id, name: label, result: "ok" });
        toast.success(`${action === "approve" ? "Approved" : "Sent back"}: ${label}`);
      } catch (e: any) {
        failed++;
        outcomes.push({ id: r.id, name: label, result: "failed", note: e?.message });
        toast.error(`Failed: ${label}`, { description: e?.message ?? "Try again." });
      }
    }

    // Record an audit entry for this bulk run (best-effort — never blocks UX).
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      const email = userRes?.user?.email ?? null;
      if (uid) {
        await supabase.from("buyer_offer_audit_log").insert({
          actor_id: uid,
          actor_email: email,
          action: action === "approve" ? "bulk_approve" : "bulk_sendback",
          offer_ids: targets.map((t) => t.id),
          outcomes,
          reason: reason ?? null,
          succeeded: ok,
          skipped,
          failed,
        });
      }
    } catch (e) {
      console.warn("[buyer-audit] failed to record", e);
    }

    setBulkBusy(null);
    setChecked(new Set());
    setSendBackOpen(false);
    setSendBackReason("");
    toast.info(`Bulk ${action === "approve" ? "approve" : "send back"} finished`, {
      description: `${ok} succeeded · ${skipped} skipped · ${failed} failed`,
    });
  };


  const onSendBackConfirm = () => {
    const trimmed = sendBackReason.trim();
    if (trimmed.length < 4 || trimmed.length > 500) {
      toast.error("Reason must be 4–500 characters");
      return;
    }
    runBulk("sendback", trimmed);
  };

  const selectedCount = checked.size;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{OFFICE.buyerMapping}</p>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Buyers and offers</h1>
        <p className="text-sm text-muted-foreground mt-1">Select offers to approve or send back in bulk, or click one to open the full flow.</p>
      </div>
      {err && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{err}</div>
      )}

      {selectedCount > 0 && (
        <div className="sticky top-[62px] z-20 rounded-xl border border-border/60 bg-background/95 backdrop-blur px-3 py-2 flex items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span> selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChecked(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              disabled={!!bulkBusy}
            >
              Clear
            </button>
            <button
              onClick={() => setSendBackOpen(true)}
              disabled={!!bulkBusy}
              className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary/40 disabled:opacity-60"
            >
              Send back
            </button>
            <button
              onClick={() => runBulk("approve")}
              disabled={!!bulkBusy}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {bulkBusy === "approve" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Approve
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-card">
        {loading && rows.length === 0 ? (
          <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No buyer offers yet.</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((r) => {
              const isChecked = checked.has(r.id);
              return (
                <li key={r.id} className={cn("flex items-center gap-2 pl-3", isChecked && "bg-primary/[0.04]")}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Select ${r.program_name || r.id}`}
                    className="h-4 w-4 accent-primary shrink-0"
                  />
                  <button
                    onClick={() => { setSelected(r); setDrawerOpen(true); }}
                    className="w-full text-left px-2 py-3 hover:bg-secondary/30 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.program_name || `Offer · ${r.id.slice(0, 8)}`}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Status: {r.status}{r.term_years ? ` · ${r.term_years} yr term` : ""}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {r.updated_at ? new Date(r.updated_at).toLocaleDateString() : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {sendBackOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 space-y-3 shadow-xl">
            <div>
              <h3 className="font-semibold">Send {selectedCount} offer{selectedCount === 1 ? "" : "s"} back</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Only offers in Draft or Sent-to-buyer can be sent back. Others will be skipped.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bulk-sendback-reason" className="text-xs font-medium">Reason (4–500 chars)</label>
              <textarea
                id="bulk-sendback-reason"
                value={sendBackReason}
                onChange={(e) => setSendBackReason(e.target.value)}
                maxLength={500}
                className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Recorded in audit history for every affected offer."
              />
              <div className="text-[10px] text-muted-foreground text-right">{sendBackReason.length}/500</div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => { setSendBackOpen(false); setSendBackReason(""); }}
                disabled={bulkBusy === "sendback"}
                className="h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary/40"
              >
                Cancel
              </button>
              <button
                onClick={onSendBackConfirm}
                disabled={bulkBusy === "sendback"}
                className="h-9 px-3 rounded-md bg-destructive text-destructive-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {bulkBusy === "sendback" && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm send back
              </button>
            </div>
          </div>
        </div>
      )}

      <BuyerMappingActionDrawer
        offer={selected}
        open={drawerOpen}
        onOpenChange={(v) => { setDrawerOpen(v); if (!v) setSelected(null); }}
        onChanged={patchRow}
      />

      <BuyerOfferAuditLog />
    </div>
  );
}


/* -------------------- Accounts -------------------- */

function AccountsRoom() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{OFFICE.accounts}</p>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Accounts & Royalty</h1>
        <p className="text-sm text-muted-foreground mt-1">Invoices, statements and creator payouts.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <AccountTile to="/admin?dept=business&section=billing" title="Invoices" desc="Buyer & subscription invoices" />
        <AccountTile to="/admin?dept=business&section=revenue-statements" title="Revenue Statements" desc="Import & map buyer statements" />
        <AccountTile to="/admin?dept=business&section=vault" title="Vault Purchases" desc="Studio vault revenue" />
      </div>
    </div>
  );
}

function AccountTile({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="rounded-xl border border-border/50 bg-card p-4 hover:bg-secondary/20 transition-colors">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
      <div className="mt-3 text-xs text-primary inline-flex items-center gap-1">Open <ArrowUpRight className="w-3 h-3" /></div>
    </Link>
  );
}
