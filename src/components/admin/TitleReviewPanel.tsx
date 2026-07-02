import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, ShieldCheck, Scale, AlertOctagon, UserCog, Lock, Unlock,
  CheckCircle2, XCircle, MinusCircle, Info, MessageSquareWarning, NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import {
  QC_CHECKLIST, LEGAL_CHECKLIST, SEND_BACK_REASONS, REASON_GROUP_LABELS,
  type ChecklistStage, type ItemStatus, type Severity, type ChecklistGroup,
} from "@/lib/review/checklists";

interface Props {
  titleId: string;
  currentStatus: string;
  onChanged?: () => void;
}

type ChecklistRow = {
  item_key: string; stage: ChecklistStage; status: ItemStatus;
  severity: Severity; blocking: boolean; note: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
};
type IssueRow = {
  id: string; stage: string; category_group: string; category_label: string;
  severity: Severity; status: "open" | "resolved" | "withdrawn";
  creator_note: string | null; internal_note: string | null;
  raised_at: string; resolved_at: string | null;
};
type NoteRow = { id: string; body: string; author_email: string | null; created_at: string };
type Assignment = { stage: ChecklistStage; reviewer_user_id: string | null; reviewer_email?: string | null };
type Candidate = { user_id: string; email: string; role: string };
type Summary = {
  qc: { total: number; done: number; blocking_open: number; reviewer_email: string | null; completion_pct: number };
  legal: { total: number; done: number; blocking_open: number; reviewer_email: string | null; completion_pct: number };
  review_clear: boolean; last_update: string | null;
};

const STATUS_OPTIONS: { value: ItemStatus; label: string; icon: any; cls: string }[] = [
  { value: "pending",         label: "Pending",         icon: MinusCircle, cls: "text-muted-foreground" },
  { value: "pass",            label: "Pass",            icon: CheckCircle2, cls: "text-emerald-400" },
  { value: "needs_attention", label: "Needs attention", icon: AlertOctagon, cls: "text-amber-400" },
  { value: "fail",            label: "Fail",            icon: XCircle, cls: "text-red-400" },
  { value: "not_applicable",  label: "Not applicable",  icon: Info, cls: "text-zinc-400" },
];

export default function TitleReviewPanel({ titleId, currentStatus, onChanged }: Props) {
  const [stage, setStage] = useState<ChecklistStage>(currentStatus === "legal_review" ? "legal" : "qc");
  const [rows, setRows] = useState<Record<string, ChecklistRow>>({});
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [sendBackOpen, setSendBackOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [chk, iss, nts, asg, cand, sm] = await Promise.all([
      (supabase as any).from("title_review_checklist").select("*").eq("title_id", titleId),
      (supabase as any).from("title_review_issues").select("*").eq("title_id", titleId).order("raised_at", { ascending: false }),
      (supabase as any).from("title_review_notes").select("*").eq("title_id", titleId).order("created_at", { ascending: false }),
      (supabase as any).from("title_review_assignments").select("*").eq("title_id", titleId),
      (supabase as any).rpc("list_review_candidates"),
      (supabase as any).rpc("title_review_summary", { _title_id: titleId }),
    ]);
    const rowMap: Record<string, ChecklistRow> = {};
    (chk.data ?? []).forEach((r: any) => { rowMap[`${r.stage}:${r.item_key}`] = r; });
    setRows(rowMap);
    setIssues((iss.data ?? []) as IssueRow[]);
    setNotes((nts.data ?? []) as NoteRow[]);
    const am: Record<string, Assignment> = {};
    (asg.data ?? []).forEach((r: any) => { am[r.stage] = { stage: r.stage, reviewer_user_id: r.reviewer_user_id }; });
    setAssignments(am);
    setCandidates((cand.data ?? []) as Candidate[]);
    setSummary(sm.data as Summary);
    setLoading(false);
  }, [titleId]);

  useEffect(() => { load(); }, [load]);

  const groups: ChecklistGroup[] = stage === "qc" ? QC_CHECKLIST : LEGAL_CHECKLIST;

  const upsertItem = async (
    stg: ChecklistStage, key: string, label: string,
    patch: Partial<Pick<ChecklistRow, "status" | "severity" | "blocking" | "note">>,
  ) => {
    const existing = rows[`${stg}:${key}`];
    const merged = {
      status:   patch.status   ?? existing?.status   ?? "pending",
      severity: patch.severity ?? existing?.severity ?? "info",
      blocking: patch.blocking ?? existing?.blocking ?? false,
      note:     patch.note     ?? existing?.note     ?? null,
    };
    setBusy(`item:${key}`);
    const { error } = await (supabase as any).rpc("upsert_title_checklist_item", {
      _title_id: titleId, _stage: stg, _item_key: key, _item_label: label,
      _status: merged.status, _severity: merged.severity,
      _blocking: merged.blocking, _note: merged.note,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const assign = async (stg: ChecklistStage, reviewer: string | null) => {
    setBusy(`assign:${stg}`);
    const { error } = await (supabase as any).rpc("assign_title_reviewer", {
      _title_id: titleId, _stage: stg, _reviewer: reviewer,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Reviewer updated");
    await load();
  };

  const addNote = async () => {
    if (!internalNote.trim()) return;
    setBusy("note");
    const { error } = await (supabase as any).rpc("add_internal_review_note", {
      _title_id: titleId, _body: internalNote.trim(),
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setInternalNote("");
    await load();
  };

  const resolveIssue = async (id: string) => {
    setBusy(`resolve:${id}`);
    const { error } = await (supabase as any).rpc("resolve_review_issue", {
      _issue_id: id, _resolution_note: null,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    await load();
    onChanged?.();
  };

  const openIssuesCount = useMemo(
    () => issues.filter(i => i.status === "open").length,
    [issues],
  );

  return (
    <div className="space-y-4">
      {/* SUMMARY BLOCK */}
      <div className="rounded-lg border border-border/50 bg-card/40 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className={summary?.review_clear ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}>
            {summary?.review_clear ? <><Unlock className="w-3 h-3 mr-1" />Review clear</> : <><Lock className="w-3 h-3 mr-1" />Blocked</>}
          </Badge>
          <Badge variant="outline">QC {summary?.qc.completion_pct ?? 0}%</Badge>
          <Badge variant="outline">Legal {summary?.legal.completion_pct ?? 0}%</Badge>
          {(summary?.qc.blocking_open ?? 0) > 0 && (
            <Badge variant="destructive">{summary?.qc.blocking_open} QC blocking</Badge>
          )}
          {(summary?.legal.blocking_open ?? 0) > 0 && (
            <Badge variant="destructive">{summary?.legal.blocking_open} legal blocking</Badge>
          )}
          {openIssuesCount > 0 && <Badge variant="outline" className="border-orange-500/40 text-orange-300">{openIssuesCount} open issue(s)</Badge>}
          {summary?.last_update && (
            <span className="text-muted-foreground ml-auto">Updated {new Date(summary.last_update).toLocaleString()}</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ReviewerAssign
            label="QC reviewer" icon={<ShieldCheck className="w-3.5 h-3.5" />}
            current={assignments.qc?.reviewer_user_id ?? null}
            candidates={candidates}
            onAssign={(v) => assign("qc", v)}
            disabled={busy === "assign:qc"}
          />
          <ReviewerAssign
            label="Legal reviewer" icon={<Scale className="w-3.5 h-3.5" />}
            current={assignments.legal?.reviewer_user_id ?? null}
            candidates={candidates}
            onAssign={(v) => assign("legal", v)}
            disabled={busy === "assign:legal"}
          />
        </div>
      </div>

      {/* SEND BACK BUTTON */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setSendBackOpen(true)}>
          <MessageSquareWarning className="w-4 h-4 mr-1" />
          Request changes (structured)
        </Button>
      </div>

      {/* CHECKLIST */}
      <Tabs value={stage} onValueChange={(v) => setStage(v as ChecklistStage)}>
        <TabsList>
          <TabsTrigger value="qc"><ShieldCheck className="w-3.5 h-3.5 mr-1" />QC Checklist</TabsTrigger>
          <TabsTrigger value="legal"><Scale className="w-3.5 h-3.5 mr-1" />Legal Checklist</TabsTrigger>
        </TabsList>
        {(["qc", "legal"] as ChecklistStage[]).map((stg) => (
          <TabsContent key={stg} value={stg} className="space-y-3 mt-3">
            {loading ? (
              <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-1" />Loading…</div>
            ) : groups.map((g) => (
              <div key={g.group} className="rounded-md border border-border/40">
                <div className="px-3 py-2 text-xs font-semibold bg-muted/30">{g.label}</div>
                <ul className="divide-y divide-border/30">
                  {g.items.map((it) => {
                    const r = rows[`${stg}:${it.key}`];
                    const status = (r?.status as ItemStatus) ?? "pending";
                    const blocking = r?.blocking ?? !!it.blockingOnFail;
                    return (
                      <li key={it.key} className="px-3 py-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-center">
                        <div>
                          <div className="text-sm">{it.label}</div>
                          {r?.note && <div className="text-xs text-muted-foreground mt-0.5">{r.note}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Checkbox
                              checked={blocking}
                              onCheckedChange={(v) => upsertItem(stg, it.key, it.label, { blocking: !!v, severity: v ? "blocking" : "non_blocking" })}
                            />
                            Blocking
                          </label>
                          <Select
                            value={status}
                            onValueChange={(v) => upsertItem(stg, it.key, it.label, { status: v as ItemStatus })}
                          >
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          className="h-8 text-xs md:w-[260px]"
                          placeholder="Reviewer note (optional)"
                          defaultValue={r?.note ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if ((r?.note ?? "") !== v) upsertItem(stg, it.key, it.label, { note: v });
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* OPEN ISSUES */}
      {issues.length > 0 && (
        <div className="rounded-md border border-border/40">
          <div className="px-3 py-2 text-xs font-semibold bg-muted/30 flex items-center gap-2">
            <AlertOctagon className="w-3.5 h-3.5 text-orange-400" /> Review issues ({issues.length})
          </div>
          <ul className="divide-y divide-border/30">
            {issues.map((i) => (
              <li key={i.id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{i.stage}</Badge>
                  <Badge variant="outline" className="text-[10px]">{REASON_GROUP_LABELS[i.category_group] ?? i.category_group}</Badge>
                  <Badge variant={i.severity === "blocking" ? "destructive" : "outline"} className="text-[10px]">{i.severity}</Badge>
                  <Badge variant="outline" className={i.status === "open" ? "border-orange-500/40 text-orange-300 text-[10px]" : "border-emerald-500/40 text-emerald-300 text-[10px]"}>{i.status}</Badge>
                  <span className="font-medium">{i.category_label}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{new Date(i.raised_at).toLocaleString()}</span>
                </div>
                {i.creator_note && <div className="mt-1 text-xs text-foreground/90"><span className="text-muted-foreground">To creator:</span> {i.creator_note}</div>}
                {i.internal_note && <div className="mt-1 text-xs text-amber-300/90"><span className="text-muted-foreground">Internal:</span> {i.internal_note}</div>}
                {i.status === "open" && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" disabled={busy === `resolve:${i.id}`} onClick={() => resolveIssue(i.id)}>
                      {busy === `resolve:${i.id}` && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Mark resolved
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* INTERNAL NOTES */}
      <div className="rounded-md border border-border/40">
        <div className="px-3 py-2 text-xs font-semibold bg-muted/30 flex items-center gap-2">
          <NotebookPen className="w-3.5 h-3.5" /> Internal notes (admin-only)
        </div>
        <div className="p-3 space-y-2">
          <Textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Internal review note. Creators never see this." />
          <Button size="sm" disabled={!internalNote.trim() || busy === "note"} onClick={addNote}>
            {busy === "note" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Add internal note
          </Button>
          <ul className="space-y-1 mt-2">
            {notes.map((n) => (
              <li key={n.id} className="text-xs rounded border border-border/30 p-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>{n.author_email || "admin"}</span>
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-0.5 whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SendBackDialog
        open={sendBackOpen}
        onOpenChange={setSendBackOpen}
        titleId={titleId}
        onDone={() => { setSendBackOpen(false); load(); onChanged?.(); }}
      />
    </div>
  );
}

function ReviewerAssign({
  label, icon, current, candidates, onAssign, disabled,
}: {
  label: string; icon: React.ReactNode; current: string | null;
  candidates: Candidate[]; onAssign: (v: string | null) => void; disabled?: boolean;
}) {
  const value = current ?? "__unassigned";
  return (
    <div className="flex items-center gap-2 text-xs rounded border border-border/30 px-2 py-1.5">
      <span className="flex items-center gap-1 text-muted-foreground"><UserCog className="w-3.5 h-3.5" />{label}</span>
      <Select value={value} onValueChange={(v) => onAssign(v === "__unassigned" ? null : v)} disabled={disabled}>
        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned">Unassigned</SelectItem>
          {candidates.map((c) => (
            <SelectItem key={c.user_id} value={c.user_id}>{c.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {icon}
    </div>
  );
}

function SendBackDialog({
  open, onOpenChange, titleId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; titleId: string; onDone: () => void }) {
  const [selected, setSelected] = useState<Record<string, { creator_note: string; internal_note: string; severity: Severity }>>({});
  const [summary, setSummary] = useState("");
  const [internal, setInternal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggle = (key: string, label: string, defSev: Severity) => {
    setSelected((s) => {
      if (s[key]) { const cp = { ...s }; delete cp[key]; return cp; }
      return { ...s, [key]: { creator_note: "", internal_note: "", severity: defSev } };
    });
    void label;
  };

  const submit = async () => {
    const keys = Object.keys(selected);
    if (keys.length === 0) return toast.error("Select at least one reason");
    if (!summary.trim())  return toast.error("Creator-facing summary is required");
    const reasons = keys.map((k) => {
      const opt = SEND_BACK_REASONS.find((o) => o.key === k)!;
      const v = selected[k];
      return {
        stage: opt.stage, group: opt.group, key: opt.key, label: opt.label,
        severity: v.severity,
        creator_note: v.creator_note,
        internal_note: v.internal_note,
      };
    });
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("request_title_changes", {
      _title_id: titleId, _reasons: reasons,
      _creator_summary: summary.trim(),
      _internal_note: internal.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Changes requested — creator notified");
    setSelected({}); setSummary(""); setInternal("");
    onDone();
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof SEND_BACK_REASONS> = {};
    SEND_BACK_REASONS.forEach((r) => { (g[r.group] = g[r.group] || []).push(r); });
    return g;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">Select at least one structured reason. Creator-facing notes are shown to the creator. Internal notes stay admin-only.</p>
          {Object.entries(grouped).map(([gk, opts]) => (
            <div key={gk} className="rounded border border-border/40">
              <div className="px-3 py-1.5 text-xs font-semibold bg-muted/30">{REASON_GROUP_LABELS[gk]}</div>
              <ul className="divide-y divide-border/30">
                {opts.map((o) => {
                  const sel = selected[o.key];
                  return (
                    <li key={o.key} className="px-3 py-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={!!sel} onCheckedChange={() => toggle(o.key, o.label, o.defaultSeverity)} />
                        <span>{o.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{o.stage}</Badge>
                      </label>
                      {sel && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Input
                            placeholder="Creator-facing note (optional)"
                            value={sel.creator_note}
                            onChange={(e) => setSelected((s) => ({ ...s, [o.key]: { ...s[o.key], creator_note: e.target.value } }))}
                          />
                          <Input
                            placeholder="Internal-only note (optional)"
                            value={sel.internal_note}
                            onChange={(e) => setSelected((s) => ({ ...s, [o.key]: { ...s[o.key], internal_note: e.target.value } }))}
                          />
                          <Select
                            value={sel.severity}
                            onValueChange={(v) => setSelected((s) => ({ ...s, [o.key]: { ...s[o.key], severity: v as Severity } }))}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="blocking">Blocking</SelectItem>
                              <SelectItem value="non_blocking">Non-blocking</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div>
            <Label className="text-xs">Creator-facing summary *</Label>
            <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What the creator must do to resolve this send-back." />
          </div>
          <div>
            <Label className="text-xs">Internal note (admin-only, optional)</Label>
            <Textarea rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Send changes request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
