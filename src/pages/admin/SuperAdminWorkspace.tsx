import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, Play, RefreshCw, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useModalSubmissionLifecycle } from "@/hooks/useModalSubmissionLifecycle";

type OnboardingRow = {
  id: string;
  client_name: string;
  professional_role: string;
  business_email: string | null;
  contact_phone: string | null;
  selected_cycle: string;
  final_price: number;
  plan_type: string;
  onboarding_status: string;
  payment_status: string;
  amount_paid_paise: number | null;
  razorpay_payment_id: string | null;
  mfi_proof_path: string | null;
  created_at: string;
  link_metadata: Record<string, unknown> | null;
};

type TitleRow = {
  id: string;
  title: string;
  status: string;
  qc_status: string;
  legal_clearance: string;
  owner_user_id: string;
  submitted_at: string | null;
  updated_at: string;
};

type ScreenerAsset = {
  id: string;
  title_id: string;
  label: string | null;
  source_kind: string | null;
  external_url: string | null;
  upload_id: string | null;
  mime_type: string | null;
  resolution: string | null;
  duration_seconds: number | null;
  file_size: number | null;
  is_active: boolean;
};

const STATUS_OPTIONS = [
  "draft",
  "submitted",
  "in_review",
  "qc_review",
  "legal_review",
  "changes_requested",
  "approved",
  "ready_for_distribution",
  "published",
  "hold",
  "rejected",
  "archived",
];

function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (["approved", "published", "ready_for_distribution"].includes(s)) return "default";
  if (["rejected", "hold"].includes(s)) return "destructive";
  if (["draft", "changes_requested"].includes(s)) return "outline";
  return "secondary";
}

export default function SuperAdminWorkspace() {
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"onboarding" | "titles">("onboarding");

  if (authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Restricted
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>This workspace is available only to accounts holding the <code className="text-foreground">super_admin</code> role.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Super-Admin Workspace</h1>
              <p className="text-xs text-muted-foreground">Onboarding review · Title governance · Screener QA</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin console
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="onboarding">Onboarding requests</TabsTrigger>
            <TabsTrigger value="titles">Titles & screeners</TabsTrigger>
          </TabsList>
          <TabsContent value="onboarding" className="mt-4">
            <OnboardingPanel />
          </TabsContent>
          <TabsContent value="titles" className="mt-4">
            <TitlesPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ------------------------------ Onboarding ------------------------------ */

function OnboardingPanel() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<OnboardingRow | null>(null);
  const [notes, setNotes] = useState("");
  const [lastDecision, setLastDecision] = useState<"approved" | "rejected" | null>(null);

  const closeDialog = () => {
    setSelected(null);
    setNotes("");
    setLastDecision(null);
    load();
  };

  const { phase, isBusy, submit } = useModalSubmissionLifecycle({
    onClose: closeDialog,
    successHoldMs: 1000,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("onboarding_requests")
      .select("id, client_name, professional_role, business_email, contact_phone, selected_cycle, final_price, plan_type, onboarding_status, payment_status, amount_paid_paise, razorpay_payment_id, mfi_proof_path, created_at, link_metadata")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Failed to load onboarding requests", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as OnboardingRow[]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.onboarding_status === filter);
  }, [rows, filter]);

  const decide = async (decision: "approved" | "rejected") => {
    if (!selected || isBusy) return;
    setLastDecision(decision);
    try {
      await submit(async () => {
        const { error } = await supabase.rpc("admin_review_onboarding_request", {
          _request_id: selected.id,
          _decision: decision,
          _notes: notes || null,
        });
        if (error) throw error;
        toast({ title: `Request ${decision}`, description: selected.client_name });
      });
    } catch (err: any) {
      setLastDecision(null);
      toast({ title: `Failed to ${decision}`, description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Incoming onboarding requests</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">KYC, banking and plan submissions awaiting super-admin review.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No requests match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.client_name}</div>
                      <div className="text-xs text-muted-foreground">{r.business_email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.professional_role}</TableCell>
                    <TableCell className="text-sm">
                      <div>{r.plan_type} · {r.selected_cycle}</div>
                      <div className="text-xs text-muted-foreground">₹{Number(r.final_price).toLocaleString("en-IN")}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.payment_status === "paid" ? "default" : "secondary"}>{r.payment_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.onboarding_status)}>{r.onboarding_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setSelected(r); setNotes(""); }}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o && isBusy) return; // block dismiss while committing / during success hold
          if (!o) { setSelected(null); setNotes(""); setLastDecision(null); }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.client_name}</DialogTitle>
            <DialogDescription>Onboarding review · {selected?.professional_role}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={selected.business_email ?? "—"} />
                <Field label="Phone" value={selected.contact_phone ?? "—"} />
                <Field label="Plan" value={`${selected.plan_type} · ${selected.selected_cycle}`} />
                <Field label="Final price" value={`₹${Number(selected.final_price).toLocaleString("en-IN")}`} />
                <Field label="Payment status" value={selected.payment_status} />
                <Field label="Razorpay id" value={selected.razorpay_payment_id ?? "—"} />
                <Field label="KYC proof" value={selected.mfi_proof_path ? "attached" : "not attached"} />
                <Field label="Current status" value={selected.onboarding_status} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Reviewer notes</label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — captured in the audit log." disabled={isBusy} />
              </div>
              {phase === "success" && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 flex items-center gap-2 text-emerald-100 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  Request {lastDecision} · closing review…
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => decide("rejected")} disabled={isBusy}>
              {isBusy && lastDecision === "rejected" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
              Reject
            </Button>
            <Button onClick={() => decide("approved")} disabled={isBusy}>
              {isBusy && lastDecision === "approved" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}

/* ------------------------------ Titles ------------------------------ */

function TitlesPanel() {
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedTitle, setSelectedTitle] = useState<TitleRow | null>(null);
  const [screeners, setScreeners] = useState<ScreenerAsset[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_titles")
      .select("id, title, status, qc_status, legal_clearance, owner_user_id, submitted_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Failed to load titles", description: error.message, variant: "destructive" });
    } else {
      setTitles((data ?? []) as TitleRow[]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return titles;
    return titles.filter((t) => t.status === filter);
  }, [titles, filter]);

  const openTitle = async (t: TitleRow) => {
    setSelectedTitle(t);
    setPendingStatus(t.status);
    setScreeners([]);
    setSignedUrls({});
    setScreenerLoading(true);
    const { data, error } = await supabase
      .from("title_screening_assets")
      .select("id, title_id, label, source_kind, external_url, upload_id, mime_type, resolution, duration_seconds, file_size, is_active")
      .eq("title_id", t.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load screeners", description: error.message, variant: "destructive" });
    } else {
      const list = (data ?? []) as ScreenerAsset[];
      setScreeners(list);
      // Resolve signed URLs for upload-backed screeners lazily via storage.
      // We assume the bucket path convention is `screeners/{upload_id}`.
      // If your project uses a different bucket, adjust here.
      const urls: Record<string, string> = {};
      await Promise.all(list.map(async (s) => {
        if (s.external_url) { urls[s.id] = s.external_url; return; }
        if (!s.upload_id) return;
        const { data: signed } = await supabase.storage
          .from("screeners")
          .createSignedUrl(s.upload_id, 60 * 30);
        if (signed?.signedUrl) urls[s.id] = signed.signedUrl;
      }));
      setSignedUrls(urls);
    }
    setScreenerLoading(false);
  };

  const saveStatus = async () => {
    if (!selectedTitle || pendingStatus === selectedTitle.status) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_set_title_status", {
      _title_id: selectedTitle.id,
      _new_status: pendingStatus,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Title status updated", description: `${selectedTitle.title} → ${pendingStatus}` });
    const updated = data as unknown as TitleRow;
    setSelectedTitle({ ...selectedTitle, status: updated.status });
    setTitles((prev) => prev.map((t) => (t.id === selectedTitle.id ? { ...t, status: updated.status } : t)));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Titles & screener review</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Review uploaded screeners and flip workflow status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No titles match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QC</TableHead>
                  <TableHead>Legal</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium max-w-xs truncate">{t.title}</TableCell>
                    <TableCell><Badge variant={statusVariant(t.status)}>{t.status}</Badge></TableCell>
                    <TableCell className="text-xs">{t.qc_status}</TableCell>
                    <TableCell className="text-xs">{t.legal_clearance}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(t.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openTitle(t)}>
                        <Play className="w-4 h-4 mr-1" /> Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedTitle} onOpenChange={(o) => !o && setSelectedTitle(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedTitle?.title}</DialogTitle>
            <DialogDescription>Screener review · workflow controls</DialogDescription>
          </DialogHeader>

          {selectedTitle && (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Screener assets</h3>
                {screenerLoading ? (
                  <div className="py-8 grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : screeners.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No screener assets attached to this title.</p>
                ) : (
                  <div className="space-y-4">
                    {screeners.map((s) => {
                      const src = signedUrls[s.id];
                      return (
                        <div key={s.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-medium text-sm">{s.label ?? "Screener"}</div>
                            <div className="text-muted-foreground">
                              {s.resolution ?? "—"} · {s.mime_type ?? "video/mp4"}
                              {s.is_active ? "" : " · inactive"}
                            </div>
                          </div>
                          {src ? (
                            <video
                              key={src}
                              controls
                              controlsList="nodownload"
                              disablePictureInPicture
                              onContextMenu={(e) => e.preventDefault()}
                              className="w-full max-h-[420px] rounded bg-black"
                              src={src}
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Preview unavailable (missing signed URL). Upload id: <code>{s.upload_id ?? "—"}</code>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Workflow status</h3>
                <div className="flex items-center gap-2">
                  <Select value={pendingStatus} onValueChange={setPendingStatus}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={saving || pendingStatus === selectedTitle.status}
                    onClick={saveStatus}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Save status
                  </Button>
                  <Badge variant={statusVariant(selectedTitle.status)} className="ml-auto">
                    Current: {selectedTitle.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Status changes are recorded server-side via <code>admin_set_title_status</code> and gated to super_admin.
                </p>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
