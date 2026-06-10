import { useEffect, useState } from "react";
import { Cloud, Loader2, KeyRound, CheckCircle2, XCircle, Link as LinkIcon, Copy, Pencil, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type OracleConfig = {
  oracle_tenancy_ocid: string;
  oracle_user_ocid: string;
  oracle_fingerprint: string;
  oracle_region: string;
  oracle_namespace: string;
  oracle_bucket: string;
  oracle_private_key_set: boolean;
  oracle_capacity_gb: number | null;
};

const EMPTY: OracleConfig = {
  oracle_tenancy_ocid: "",
  oracle_user_ocid: "",
  oracle_fingerprint: "",
  oracle_region: "ap-mumbai-1",
  oracle_namespace: "",
  oracle_bucket: "",
  oracle_private_key_set: false,
  oracle_capacity_gb: null,
};

function mask(s: string, head = 6, tail = 4) {
  if (!s) return "—";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}••••${s.slice(-tail)}`;
}

function hasAllRequired(c: OracleConfig) {
  return !!(c.oracle_tenancy_ocid && c.oracle_user_ocid && c.oracle_fingerprint &&
            c.oracle_region && c.oracle_namespace && c.oracle_bucket && c.oracle_private_key_set);
}

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function StorageGauge({
  usage, capacityGb, loading, onRefresh, disabled,
}: {
  usage: { bytes: number; count: number; truncated: boolean } | null;
  capacityGb: number | null;
  loading: boolean;
  onRefresh: () => void;
  disabled: boolean;
}) {
  const capacityBytes = capacityGb ? capacityGb * 1024 ** 3 : 0;
  const usedBytes = usage?.bytes ?? 0;
  const pct = capacityBytes > 0 ? Math.min(100, (usedBytes / capacityBytes) * 100) : 0;
  const tier = pct >= 90 ? "red" : pct >= 70 ? "yellow" : "green";
  const barColor =
    tier === "red" ? "bg-gradient-to-r from-rose-500 to-red-600" :
    tier === "yellow" ? "bg-gradient-to-r from-amber-400 to-orange-500" :
    "bg-gradient-to-r from-emerald-400 to-cyan-400";
  const ringColor =
    tier === "red" ? "text-red-400" :
    tier === "yellow" ? "text-amber-400" :
    "text-emerald-400";
  const labelTone =
    tier === "red" ? "bg-red-500/15 text-red-400 border-red-500/30" :
    tier === "yellow" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Bucket usage</div>
          <div className={cn("font-display text-2xl font-bold mt-1", ringColor)}>
            {capacityBytes > 0 ? `${pct.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {usage ? (
              <>
                {formatBytes(usedBytes)}
                {capacityBytes > 0 ? ` of ${formatBytes(capacityBytes)}` : ""}
                {" · "}{usage.count.toLocaleString()} objects
                {usage.truncated ? " (sampled)" : ""}
              </>
            ) : (
              capacityGb ? "No usage data yet" : "Set Bucket Capacity in credentials to enable gauge"
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {capacityBytes > 0 && (
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wider", labelTone)}>
              {tier === "red" ? "Critical" : tier === "yellow" ? "Warning" : "Healthy"}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading || disabled}
            className="h-9 px-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="relative h-3 rounded-full bg-secondary/60 overflow-hidden border border-border/40">
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-700 ease-out", barColor)}
          style={{ width: `${capacityBytes > 0 ? pct : 0}%` }}
        />
        {/* threshold ticks at 70% and 90% */}
        <div className="absolute inset-y-0 w-px bg-foreground/20" style={{ left: "70%" }} />
        <div className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: "90%" }} />
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>0</span><span>70% warn</span><span>90% crit</span><span>{capacityGb ? `${capacityGb} GB` : "—"}</span>
      </div>
    </div>
  );
}

export default function OracleStorageMonitor() {
  const [cfg, setCfg] = useState<OracleConfig>(EMPTY);
  const [draft, setDraft] = useState<OracleConfig>(EMPTY);
  const [pem, setPem] = useState("");
  const [showPem, setShowPem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verified, setVerified] = useState<null | boolean>(null);
  const [verifyMsg, setVerifyMsg] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [parUrl, setParUrl] = useState<string | null>(null);
  const [creatingPar, setCreatingPar] = useState(false);

  const [usage, setUsage] = useState<{ bytes: number; count: number; truncated: boolean } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("site_config")
      .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket, oracle_private_key_set, oracle_private_key, oracle_capacity_gb")
      .eq("id", true)
      .maybeSingle();
    const next: OracleConfig = data ? {
      oracle_tenancy_ocid: data.oracle_tenancy_ocid ?? "",
      oracle_user_ocid: data.oracle_user_ocid ?? "",
      oracle_fingerprint: data.oracle_fingerprint ?? "",
      oracle_region: data.oracle_region ?? "ap-mumbai-1",
      oracle_namespace: data.oracle_namespace ?? "",
      oracle_bucket: data.oracle_bucket ?? "",
      oracle_private_key_set: !!data.oracle_private_key_set || !!data.oracle_private_key,
      oracle_capacity_gb: data.oracle_capacity_gb != null ? Number(data.oracle_capacity_gb) : null,
    } : EMPTY;
    setCfg(next);
    setDraft(next);
    setEditing(!hasAllRequired(next));
    setLoading(false);
  };

  const fetchUsage = async (silent = false) => {
    setLoadingUsage(true);
    const { data, error } = await supabase.functions.invoke("oracle-proxy", { body: { action: "usage" } });
    setLoadingUsage(false);
    if (error || !data?.ok) {
      if (!silent) toast.error("Could not read bucket usage", { description: error?.message ?? data?.error });
      return;
    }
    setUsage({ bytes: Number(data.totalBytes ?? 0), count: Number(data.objectCount ?? 0), truncated: !!data.truncated });
  };

  const runTest = async (silent = false): Promise<boolean> => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("oracle-proxy", { body: { action: "test" } });
    setTesting(false);
    const ok = !error && !!data?.ok;
    setVerified(ok);
    setVerifyMsg(ok ? `Reached bucket "${data.bucket}" in ${data.region}` : (error?.message ?? data?.error ?? "Unknown error"));
    if (!silent) {
      if (ok) toast.success("Oracle connection verified");
      else toast.error("Oracle verification failed", { description: data?.error ?? error?.message });
    }
    return ok;
  };

  useEffect(() => {
    (async () => {
      await load();
      // Auto-verify in the background if fully configured
      // (do not toast on the silent first run).
    })();
  }, []);

  useEffect(() => {
    if (!loading && !editing && hasAllRequired(cfg) && verified === null) {
      runTest(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, editing, cfg]);

  useEffect(() => {
    if (verified === true && usage === null) {
      fetchUsage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  const save = async () => {
    // Light client-side validation
    const required: Array<[keyof OracleConfig, string]> = [
      ["oracle_tenancy_ocid", "Tenancy OCID"],
      ["oracle_user_ocid", "User OCID"],
      ["oracle_fingerprint", "Fingerprint"],
      ["oracle_region", "Region"],
      ["oracle_namespace", "Namespace"],
      ["oracle_bucket", "Bucket"],
    ];
    for (const [k, label] of required) {
      if (!String(draft[k] ?? "").trim()) {
        toast.error(`${label} is required`);
        return;
      }
    }
    const trimmedPem = pem.trim();
    if (!cfg.oracle_private_key_set && !trimmedPem) {
      toast.error("Paste the Oracle private key (PEM) to complete setup.");
      return;
    }
    if (trimmedPem && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(trimmedPem)) {
      toast.error("Private key must be a PEM-encoded block (BEGIN/END headers).");
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = { id: true, ...draft };
    if (trimmedPem) {
      payload.oracle_private_key = trimmedPem;
      payload.oracle_private_key_set = true;
    }
    const { error } = await supabase.from("site_config").upsert(payload, { onConflict: "id" });
    if (error) { setSaving(false); toast.error(error.message); return; }
    setPem(""); setShowPem(false);
    await load();
    setSaving(false);
    // Auto-validate after save
    const ok = await runTest(false);
    if (ok) setEditing(false);
  };

  const createPar = async () => {
    setCreatingPar(true); setParUrl(null);
    const { data, error } = await supabase.functions.invoke("oracle-proxy", {
      body: { action: "create-par", name: `camera-ingest-${Date.now()}`, objectName: "ingest/", accessType: "AnyObjectWrite" },
    });
    setCreatingPar(false);
    if (error || !data?.ok) { toast.error(error?.message ?? data?.error ?? "Failed to create PAR"); return; }
    setParUrl(data.url);
    toast.success("PAR URL created (valid for 7 days)");
  };

  const StatusBadge = () => {
    if (loading) return null;
    if (!hasAllRequired(cfg)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3" /> Setup required
        </span>
      );
    }
    if (verified === true) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3" /> Verified
        </span>
      );
    }
    if (verified === false) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 text-destructive text-[11px] font-semibold uppercase tracking-wider">
          <XCircle className="w-3 h-3" /> Verification failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
        <Loader2 className="w-3 h-3 animate-spin" /> Verifying…
      </span>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-accent" /> Oracle OCI Storage
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Configure your Oracle Cloud bucket. Private key is stored as a backend secret — never sent to the browser.
          </p>
        </div>
        <StatusBadge />
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : editing ? (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tenancy OCID" value={draft.oracle_tenancy_ocid} onChange={v => setDraft({ ...draft, oracle_tenancy_ocid: v })} placeholder="ocid1.tenancy.oc1..." />
            <Field label="User OCID" value={draft.oracle_user_ocid} onChange={v => setDraft({ ...draft, oracle_user_ocid: v })} placeholder="ocid1.user.oc1..." />
            <Field label="Key Fingerprint" value={draft.oracle_fingerprint} onChange={v => setDraft({ ...draft, oracle_fingerprint: v })} placeholder="aa:bb:cc:..." />
            <Field label="Region" value={draft.oracle_region} onChange={v => setDraft({ ...draft, oracle_region: v })} placeholder="ap-mumbai-1" />
            <Field label="Namespace" value={draft.oracle_namespace} onChange={v => setDraft({ ...draft, oracle_namespace: v })} placeholder="axxxxxxxxxx" />
            <Field label="Bucket" value={draft.oracle_bucket} onChange={v => setDraft({ ...draft, oracle_bucket: v })} placeholder="streamvista-media" />
            <Field
              label="Bucket Capacity (GB) — for usage gauge"
              value={draft.oracle_capacity_gb != null ? String(draft.oracle_capacity_gb) : ""}
              onChange={v => setDraft({ ...draft, oracle_capacity_gb: v.trim() === "" ? null : Number(v) })}
              placeholder="e.g. 1024"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5" /> Oracle Private Key (PEM, PKCS#8)
              </label>
              <button type="button" onClick={() => setShowPem(s => !s)}
                className="text-[11px] uppercase tracking-wider text-accent hover:underline">
                {showPem ? "Hide" : "Show"}
              </button>
            </div>
            <textarea
              value={pem}
              onChange={e => setPem(e.target.value)}
              placeholder={cfg.oracle_private_key_set
                ? "•••••••••• key on file. Paste a new PEM only to rotate."
                : "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----"}
              rows={6}
              spellCheck={false}
              autoComplete="off"
              className={cn(
                "w-full px-3 py-2 rounded-xl bg-secondary/40 border border-border/60 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y",
                showPem ? "" : "[-webkit-text-security:disc]",
              )}
              style={showPem ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
            />
            <p className="text-[11px] text-muted-foreground">
              Stored encrypted at rest, readable only by admins and the signing function.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={saving || testing}
              className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm disabled:opacity-60 inline-flex items-center gap-2"
            >
              {(saving || testing) && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : testing ? "Verifying…" : "Save & verify"}
            </button>
            {hasAllRequired(cfg) && (
              <button
                onClick={() => { setDraft(cfg); setPem(""); setEditing(false); }}
                className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold"
              >Cancel</button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <ReadRow label="Tenancy OCID" value={mask(cfg.oracle_tenancy_ocid, 18, 6)} />
            <ReadRow label="User OCID" value={mask(cfg.oracle_user_ocid, 18, 6)} />
            <ReadRow label="Fingerprint" value={cfg.oracle_fingerprint} />
            <ReadRow label="Region" value={cfg.oracle_region} />
            <ReadRow label="Namespace" value={cfg.oracle_namespace} />
            <ReadRow label="Bucket" value={cfg.oracle_bucket} />
            <ReadRow label="Private key" value={cfg.oracle_private_key_set ? "•••••••• on file" : "not set"} />
          </div>

          <StorageGauge
            usage={usage}
            capacityGb={cfg.oracle_capacity_gb}
            loading={loadingUsage}
            onRefresh={() => fetchUsage(false)}
            disabled={verified !== true}
          />

          {verifyMsg && verified === false && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span className="font-mono break-all">{verifyMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditing(true)}
              className="h-11 px-5 rounded-xl border border-accent/40 text-accent hover:bg-accent/10 text-sm font-semibold inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit credentials
            </button>
            <button
              onClick={() => runTest(false)}
              disabled={testing}
              className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Re-test connection
            </button>
            <button
              onClick={createPar}
              disabled={creatingPar}
              className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"
            >
              {creatingPar ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              Create Camera Ingest URL (PAR)
            </button>
          </div>

          {parUrl && (
            <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold">Pre-Authenticated Request URL (write-only, 7 days)</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(parUrl); toast.success("Copied"); }}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                ><Copy className="w-3 h-3" /> Copy</button>
              </div>
              <p className="font-mono break-all">{parUrl}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-foreground text-[13px] mt-0.5 truncate">{value || "—"}</div>
    </div>
  );
}

