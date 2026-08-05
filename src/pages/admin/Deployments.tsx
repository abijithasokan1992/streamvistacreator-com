import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Globe, Loader2, Lock, RefreshCw,
  Rocket, ShieldAlert, ShieldCheck, Trash2, Unlock, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

/**
 * StreamVista Deployment Control — admin-only hosting console.
 * All Vercel access is proxied through the `vercel-admin-proxy` edge function;
 * no provider token is ever present in the browser.
 */

type VercelProject = {
  id: string;
  name: string;
  ssoProtection?: { deploymentType?: string } | null;
  passwordProtection?: unknown;
  targets?: { production?: { alias?: string[]; url?: string } | null } | null;
};

type VercelDeployment = {
  uid: string;
  name: string;
  url: string;
  state?: string;
  target?: string | null;
  created?: number;
};

type DomainRow = { name: string; verified?: boolean; apexName?: string };

type StatusResponse = {
  connected: boolean;
  missing_secrets?: string[];
  optional_secrets?: string[];
  team_scoped?: boolean;
  error?: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  result: string;
  actor_email: string | null;
  target_label: string | null;
  error_summary: string | null;
  created_at: string;
};

const CARD = "rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4 sm:p-5";

async function callProxy<T = any>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("vercel-admin-proxy", { body: payload });
  if (error) {
    // Surface the function's JSON error body when present.
    const ctx = (error as any)?.context;
    let detail = error.message;
    try {
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        detail = body?.error ?? detail;
      }
    } catch { /* keep original message */ }
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export default function Deployments() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [deployments, setDeployments] = useState<VercelDeployment[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; status_code: number | null; response_ms: number } | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [newDomain, setNewDomain] = useState("");

  const [confirmProtection, setConfirmProtection] = useState<null | { enable: boolean }>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteDeployment, setDeleteDeployment] = useState<VercelDeployment | null>(null);
  const [typedProject, setTypedProject] = useState("");
  const [typedDeployment, setTypedDeployment] = useState("");

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );
  const isProtected = Boolean(selected?.ssoProtection || selected?.passwordProtection);
  const publicHost = useMemo(() => {
    const alias = selected?.targets?.production?.alias?.[0];
    return alias ?? selected?.targets?.production?.url ?? deployments[0]?.url ?? null;
  }, [selected, deployments]);

  const loadAudit = useCallback(async () => {
    const { data } = await supabase
      .from("deployment_audit_log")
      .select("id, action, result, actor_email, target_label, error_summary, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    setAudit((data as AuditRow[]) ?? []);
  }, []);

  const loadProjects = useCallback(async () => {
    const res = await callProxy<{ data?: { projects?: VercelProject[] } }>({ action: "list_projects" });
    const list = res?.data?.projects ?? [];
    setProjects(list);
    setSelectedId((cur) => cur || list[0]?.id || "");
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const st = await callProxy<StatusResponse>({ action: "status" });
      setStatus(st);
      if (st.connected) await loadProjects();
    } catch (e) {
      setStatus({ connected: false, error: (e as Error).message });
    } finally {
      setLoading(false);
      loadAudit();
    }
  }, [loadProjects, loadAudit]);

  useEffect(() => { if (isAdmin) refreshAll(); }, [isAdmin, refreshAll]);

  const loadProjectDetail = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setBusy("detail");
    try {
      const [deps, doms, proj] = await Promise.all([
        callProxy<{ data?: { deployments?: VercelDeployment[] } }>({ action: "list_deployments", project_id: projectId, limit: 8 }),
        callProxy<{ data?: { domains?: DomainRow[] } }>({ action: "list_domains", project_id: projectId }),
        callProxy<{ data?: VercelProject }>({ action: "get_project", project_id: projectId }),
      ]);
      setDeployments(deps?.data?.deployments ?? []);
      setDomains(doms?.data?.domains ?? []);
      if (proj?.data) setProjects((p) => p.map((x) => (x.id === projectId ? { ...x, ...proj.data! } : x)));
      setHealth(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => { if (selectedId) loadProjectDetail(selectedId); }, [selectedId, loadProjectDetail]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); loadAudit(); }
  };

  const applyProtection = (enable: boolean) =>
    run("protection", async () => {
      await callProxy({ action: "set_protection", project_id: selectedId, enabled: enable, scope: "all" });
      toast.success(enable ? "Deployment is now private (protected)" : "Deployment is now public");
      setConfirmProtection(null);
      await loadProjectDetail(selectedId);
    });

  const runHealth = () =>
    run("health", async () => {
      if (!publicHost) { toast.error("No public hostname available for this project."); return; }
      const res = await callProxy<{ ok: boolean; status_code: number | null; response_ms: number }>({
        action: "health_check", host: publicHost.replace(/^https?:\/\//, ""),
      });
      setHealth(res);
    });

  if (authLoading) {
    return <div className="min-h-dvh grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth?next=/admin/deployments" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const missing = status?.missing_secrets ?? [];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Admin
          </a>
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">StreamVista Deployment Control</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Connection */}
        {loading ? (
          <div className={`${CARD} flex items-center gap-2 text-muted-foreground`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Checking hosting connection…
          </div>
        ) : !status?.connected ? (
          <div className={`${CARD} border-amber-400/40 bg-amber-500/5`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" aria-hidden />
              <div className="space-y-1">
                <p className="font-medium text-amber-200">Vercel not connected</p>
                <p className="text-sm text-muted-foreground">
                  {missing.length > 0
                    ? <>Add the following edge function secret{missing.length > 1 ? "s" : ""}: <code className="text-amber-200">{missing.join(", ")}</code>. Optional: <code>VERCEL_TEAM_ID</code> for team-scoped accounts.</>
                    : status?.error ?? "The hosting API could not be reached."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Secret values are never shown here. See <code>docs/DEPLOYMENT_CONTROL.md</code> for least-privilege token guidance.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={`${CARD} flex flex-wrap items-center gap-3`}>
            <span className="inline-flex items-center gap-1.5 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Connected to Vercel
            </span>
            {status.team_scoped && <Badge variant="outline">Team scoped</Badge>}
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="project" className="text-xs text-muted-foreground">Project</label>
              <select
                id="project"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm min-w-[180px]"
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {status?.connected && selected && (
          <>
            {/* Visibility */}
            <section className={CARD}>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold">Visibility</h2>
                <Badge className={isProtected ? "bg-amber-500/15 text-amber-300 border-amber-400/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-400/40"} variant="outline">
                  {isProtected ? <><Lock className="w-3 h-3 mr-1" /> Private / Protected</> : <><Unlock className="w-3 h-3 mr-1" /> Public</>}
                </Badge>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant={isProtected ? "default" : "outline"} disabled={busy === "protection"}
                    onClick={() => setConfirmProtection({ enable: !isProtected })}>
                    {busy === "protection" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : isProtected ? <Unlock className="w-4 h-4 mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
                    {isProtected ? "Open Public" : "Close Private"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={runHealth} disabled={busy === "health"}>
                    {busy === "health" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Health check
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Public host: {publicHost ? <code>{publicHost}</code> : "unknown"}
              </p>
              {health && (
                <p className={`text-xs mt-1 inline-flex items-center gap-1.5 ${health.ok ? "text-emerald-300" : "text-red-300"}`}>
                  {health.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  HTTP {health.status_code ?? "—"} · {health.response_ms} ms
                </p>
              )}
            </section>

            {/* Deployments */}
            <section className={CARD}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold">Recent deployments</h2>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => loadProjectDetail(selectedId)} disabled={busy === "detail"}>
                  <RefreshCw className={`w-4 h-4 ${busy === "detail" ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="space-y-2">
                {deployments.length === 0 && <p className="text-sm text-muted-foreground">No deployments found.</p>}
                {deployments.map((d) => (
                  <div key={d.uid} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                    <code className="text-xs truncate max-w-[220px]">{d.url}</code>
                    <Badge variant="outline" className="text-[10px]">{d.target ?? "preview"}</Badge>
                    <Badge variant="outline" className="text-[10px]">{d.state ?? "—"}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {d.created ? new Date(d.created).toLocaleString() : ""}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy === `redeploy-${d.uid}`}
                        onClick={() => run(`redeploy-${d.uid}`, async () => {
                          await callProxy({ action: "redeploy", deployment_id: d.uid, name: selected.name, target: d.target ?? undefined });
                          toast.success("Redeploy requested");
                          await loadProjectDetail(selectedId);
                        })}>
                        {busy === `redeploy-${d.uid}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                        <span className="ml-1.5 hidden sm:inline">Redeploy</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200"
                        onClick={() => { setDeleteDeployment(d); setTypedDeployment(""); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Domains */}
            <section className={CARD}>
              <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-2"><Globe className="w-4 h-4" /> Domains</h2>
              <div className="space-y-2">
                {domains.length === 0 && <p className="text-sm text-muted-foreground">No domains attached.</p>}
                {domains.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                    <code className="text-xs">{d.name}</code>
                    {d.verified ? <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-400/40">verified</Badge>
                      : <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-400/40">pending</Badge>}
                    <Button size="sm" variant="ghost" className="ml-auto text-red-300"
                      disabled={busy === `domain-${d.name}`}
                      onClick={() => run(`domain-${d.name}`, async () => {
                        await callProxy({ action: "remove_domain", project_id: selectedId, domain: d.name });
                        toast.success("Domain removed");
                        await loadProjectDetail(selectedId);
                      })}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" aria-label="New domain" className="h-9" />
                <Button size="sm" variant="outline" disabled={!newDomain || busy === "add-domain"}
                  onClick={() => run("add-domain", async () => {
                    await callProxy({ action: "add_domain", project_id: selectedId, domain: newDomain.trim().toLowerCase() });
                    toast.success("Domain added");
                    setNewDomain("");
                    await loadProjectDetail(selectedId);
                  })}>
                  Add
                </Button>
              </div>
            </section>

            {/* Danger zone */}
            <section className={`${CARD} border-red-500/40 bg-red-500/[0.04]`}>
              <h2 className="text-sm font-semibold text-red-300 inline-flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Danger zone
              </h2>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Deleting a project removes all of its deployments and domain bindings. This cannot be undone.
              </p>
              <Button size="sm" variant="destructive" onClick={() => { setDeleteProjectOpen(true); setTypedProject(""); }}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete project “{selected.name}”
              </Button>
            </section>
          </>
        )}

        {/* Audit */}
        <section className={CARD}>
          <h2 className="text-sm font-semibold mb-3">Recent deployment actions</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployment actions recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {audit.map((a) => (
                <li key={a.id} className="text-xs flex flex-wrap items-center gap-2">
                  <span className={a.result === "success" ? "text-emerald-300" : "text-red-300"}>{a.result}</span>
                  <code>{a.action}</code>
                  <span className="text-muted-foreground">{a.target_label ?? ""}</span>
                  <span className="text-muted-foreground">{a.actor_email ?? "—"}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleString()}</span>
                  {a.error_summary && <span className="w-full text-red-300/80">{a.error_summary}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Protection confirm */}
      <AlertDialog open={confirmProtection !== null} onOpenChange={(o) => !o && setConfirmProtection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmProtection?.enable ? "Make deployments private?" : "Make deployments public?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmProtection?.enable
                ? "Vercel authentication will be required for every deployment of this project. Anonymous visitors will receive a 401 until protection is turned off."
                : "Protection will be removed. Every deployment URL of this project becomes reachable by anyone on the internet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmProtection && applyProtection(confirmProtection.enable)}>
              Apply change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete deployment */}
      <AlertDialog open={deleteDeployment !== null} onOpenChange={(o) => !o && setDeleteDeployment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Type the deployment id <code>{deleteDeployment?.uid}</code> to confirm. This permanently removes the deployment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={typedDeployment} onChange={(e) => setTypedDeployment(e.target.value)} placeholder={deleteDeployment?.uid} aria-label="Deployment id confirmation" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={typedDeployment !== deleteDeployment?.uid}
              onClick={() => {
                const d = deleteDeployment;
                if (!d) return;
                setDeleteDeployment(null);
                run("delete-deployment", async () => {
                  await callProxy({ action: "delete_deployment", deployment_id: d.uid, confirm: d.uid });
                  toast.success("Deployment deleted");
                  await loadProjectDetail(selectedId);
                });
              }}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete project */}
      <AlertDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-300">Delete project “{selected?.name}”</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the hosting project, all deployments and domain bindings. Type the exact project name to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={typedProject} onChange={(e) => setTypedProject(e.target.value)} placeholder={selected?.name} aria-label="Project name confirmation" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!selected || typedProject !== selected.name}
              onClick={() => {
                if (!selected) return;
                setDeleteProjectOpen(false);
                run("delete-project", async () => {
                  await callProxy({ action: "delete_project", project_id: selected.id, name: selected.name, confirm: selected.name });
                  toast.success("Project deleted");
                  setSelectedId("");
                  await refreshAll();
                });
              }}>
              Delete project permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
