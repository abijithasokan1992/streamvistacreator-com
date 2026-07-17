import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity, CheckCircle2, Film, Loader2, Lock, RefreshCw, Scale, ShieldCheck, Volume2, Monitor,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * QCLegalValidationSurface
 * ────────────────────────
 * Dual-panel operational surface behind the Admin "QC Queue" and "Legal Queue"
 * quick actions. Reads titles filtered by review status and writes the new
 * columns added in migration 20260716073359:
 *   - content_titles.qc_status         (pending | resolution_verified | audio_clean | passed | flagged)
 *   - content_titles.legal_clearance   (pending | under_review | cleared | rejected)
 *   - content_titles.master_rule_enforced (immutable except super_admin)
 *
 * Copy is deliberate: the master rule badge is a *display* affordance, but the
 * DB trigger `trg_guard_master_rule_enforced` is the real enforcement point.
 */

type Panel = "qc" | "legal";

type TitleRow = {
  id: string;
  title: string;
  status: string;
  qc_status: string | null;
  legal_clearance: string | null;
  master_rule_enforced: boolean | null;
  updated_at: string;
};

const REVIEW_STATUSES: Record<Panel, string[]> = {
  qc: ["qc_review", "in_review", "submitted"],
  legal: ["legal_review", "in_review"],
};

export default function QCLegalValidationSurface({ initialPanel = "qc" }: { initialPanel?: Panel }) {
  const [panel, setPanel] = useState<Panel>(initialPanel);
  useEffect(() => setPanel(initialPanel), [initialPanel]);

  return (
    <section className="rounded-2xl border border-border/50 bg-secondary/10 p-4 md:p-5 space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">
            Review Operations
          </p>
          <h2 className="text-lg font-semibold mt-0.5">QC &amp; Legal Validation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational panel to advance titles through Quality Control and Legal Clearance.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border/60 bg-background/50 p-0.5">
          <TabButton active={panel === "qc"} onClick={() => setPanel("qc")} icon={<Film className="w-3.5 h-3.5" />}>
            QC Panel
          </TabButton>
          <TabButton active={panel === "legal"} onClick={() => setPanel("legal")} icon={<Scale className="w-3.5 h-3.5" />}>
            Legal Panel
          </TabButton>
        </div>
      </header>

      {panel === "qc" ? <QCPanel /> : <LegalPanel />}
    </section>
  );
}

function TabButton({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold transition-colors",
        active ? "bg-accent/20 text-foreground border border-accent/40" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ─────────────────────────── QC Panel ─────────────────────────── */

function QCPanel() {
  const { rows, loading, reload, patch } = useReviewTitles("qc");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const toggleFlag = useCallback(
    async (row: TitleRow, flag: "resolution" | "audio") => {
      setBusy((b) => ({ ...b, [row.id]: true }));
      try {
        // Encode both flags into qc_status. This mirrors the two toggles the
        // reviewer operates on. When both are set we auto-advance to "passed".
        const current = row.qc_status ?? "pending";
        const hasRes = current.includes("resolution");
        const hasAud = current.includes("audio");
        const nextRes = flag === "resolution" ? !hasRes : hasRes;
        const nextAud = flag === "audio" ? !hasAud : hasAud;
        let next = "pending";
        if (nextRes && nextAud) next = "passed";
        else if (nextRes) next = "resolution_verified";
        else if (nextAud) next = "audio_clean";
        const { error } = await (supabase as any)
          .from("content_titles").update({ qc_status: next }).eq("id", row.id);
        if (error) throw error;
        patch(row.id, { qc_status: next });
        toast.success("QC status updated", { description: `${row.title} → ${next.replace(/_/g, " ")}` });
      } catch (e: any) {
        toast.error(e?.message ?? "Could not update QC status");
      } finally {
        setBusy((b) => ({ ...b, [row.id]: false }));
      }
    },
    [patch],
  );

  return (
    <div className="space-y-3">
      <SurfaceHeader
        icon={<Film className="w-4 h-4 text-cyan-300" />}
        title="Quality Control Queue"
        subtitle={`${rows.length} title${rows.length === 1 ? "" : "s"} awaiting QC verification`}
        onReload={reload}
      />

      {loading ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <EmptyState label="No titles are waiting on QC right now." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const qc = r.qc_status ?? "pending";
            const resOn = qc === "resolution_verified" || qc === "passed";
            const audOn = qc === "audio_clean" || qc === "passed";
            return (
              <li key={r.id} className="rounded-xl border border-border/50 bg-background/40 p-3 md:p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Status <span className="uppercase tracking-wider">{r.status.replace(/_/g, " ")}</span>
                      {" · "}QC <span className="uppercase tracking-wider">{qc.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                  <QCVerdict qc={qc} />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <ToggleChip
                    active={resOn}
                    disabled={!!busy[r.id]}
                    onClick={() => toggleFlag(r, "resolution")}
                    icon={<Monitor className="w-3.5 h-3.5" />}
                    label="Resolution Verified"
                  />
                  <ToggleChip
                    active={audOn}
                    disabled={!!busy[r.id]}
                    onClick={() => toggleFlag(r, "audio")}
                    icon={<Volume2 className="w-3.5 h-3.5" />}
                    label="Audio Tracks Clean"
                  />
                  {busy[r.id] && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QCVerdict({ qc }: { qc: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    pending: { label: "Pending", tone: "text-muted-foreground border-border/60 bg-secondary/40" },
    resolution_verified: { label: "Resolution ✓", tone: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10" },
    audio_clean: { label: "Audio ✓", tone: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10" },
    passed: { label: "QC Passed", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
    flagged: { label: "Flagged", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  };
  const m = map[qc] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5", m.tone)}>
      {m.label}
    </span>
  );
}

/* ─────────────────────────── Legal Panel ─────────────────────────── */

function LegalPanel() {
  const { rows, loading, reload, patch } = useReviewTitles("legal");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const grantClearance = useCallback(async (row: TitleRow) => {
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      const { error } = await (supabase as any)
        .from("content_titles")
        .update({ legal_clearance: "cleared" })
        .eq("id", row.id);
      if (error) throw error;
      patch(row.id, { legal_clearance: "cleared" });
      toast.success("Distribution clearance granted", {
        description: `${row.title} — master rule remains in force.`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not grant clearance");
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  }, [patch]);

  return (
    <div className="space-y-3">
      <SurfaceHeader
        icon={<Scale className="w-4 h-4 text-fuchsia-300" />}
        title="Legal Clearance Queue"
        subtitle={`${rows.length} title${rows.length === 1 ? "" : "s"} awaiting legal review`}
        onReload={reload}
      />

      <div className="rounded-xl border-2 border-white/20 bg-gradient-to-br from-amber-950/80 via-amber-900/70 to-yellow-900/60 shadow-lg shadow-amber-950/40 p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/20 grid place-items-center shrink-0">
          <Lock className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-snug tracking-tight">
            Immutable Rule Attached: Non-Sublicensable / No Right to Deliver to Next Person.
          </p>
          <p className="text-[11px] text-white/70 mt-1">
            Master rule enforced at the database layer by Platform Super Admin.
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <EmptyState label="No titles are waiting on legal review right now." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const legal = r.legal_clearance ?? "pending";
            const cleared = legal === "cleared";
            return (
              <li key={r.id} className="rounded-xl border border-border/50 bg-background/40 p-3 md:p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Status <span className="uppercase tracking-wider">{r.status.replace(/_/g, " ")}</span>
                      {" · "}Legal <span className="uppercase tracking-wider">{legal.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                  <LegalVerdict legal={legal} />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 border-amber-500/40 bg-amber-500/10 text-amber-200"
                    title="Master rule is DB-enforced and cannot be lifted from this surface."
                  >
                    <Lock className="w-3 h-3" />
                    Master rule locked
                  </span>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    disabled={!!busy[r.id] || cleared}
                    onClick={() => grantClearance(r)}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors",
                      "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {busy[r.id]
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Granting…</>
                      : cleared
                        ? <><ShieldCheck className="w-3.5 h-3.5" /> Clearance granted</>
                        : <><ShieldCheck className="w-3.5 h-3.5" /> Grant Distribution Clearance</>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LegalVerdict({ legal }: { legal: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    pending: { label: "Pending", tone: "text-muted-foreground border-border/60 bg-secondary/40" },
    under_review: { label: "Under Review", tone: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10" },
    cleared: { label: "Cleared", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
    rejected: { label: "Rejected", tone: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
  };
  const m = map[legal] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5", m.tone)}>
      {m.label}
    </span>
  );
}

/* ─────────────────────────── Shared ─────────────────────────── */

function useReviewTitles(panel: Panel) {
  const [rows, setRows] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const statuses = useMemo(() => REVIEW_STATUSES[panel], [panel]);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("content_titles")
      .select("id, title, status, qc_status, legal_clearance, master_rule_enforced, updated_at")
      .in("status", statuses)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      // RLS scoping may filter this to zero for non-admins.
      setRows([]);
    } else {
      setRows((data ?? []) as TitleRow[]);
    }
    setLoading(false);
  }, [statuses]);

  useEffect(() => { reload(); }, [reload]);

  const patch = useCallback((id: string, next: Partial<TitleRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  return { rows, loading, reload, patch };
}

function SurfaceHeader({
  icon, title, subtitle, onReload,
}: { icon: React.ReactNode; title: string; subtitle: string; onReload: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-secondary/40 grid place-items-center">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <button
        onClick={onReload}
        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}

function ToggleChip({
  active, disabled, onClick, icon, label,
}: { active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-colors",
        active
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
          : "border-border/60 bg-secondary/30 text-foreground hover:bg-secondary/60",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      aria-pressed={active}
    >
      {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : icon}
      {label}
    </button>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-xl border border-border/40 bg-background/30 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-6 text-center">
      <Activity className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
