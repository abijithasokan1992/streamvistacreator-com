import { useEffect, useState } from "react";
import { Cloud, Loader2, KeyRound, CheckCircle2, XCircle, Link as LinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type OracleConfig = {
  oracle_tenancy_ocid: string;
  oracle_user_ocid: string;
  oracle_fingerprint: string;
  oracle_region: string;
  oracle_namespace: string;
  oracle_bucket: string;
  oracle_private_key_set: boolean;
};

const EMPTY: OracleConfig = {
  oracle_tenancy_ocid: "",
  oracle_user_ocid: "",
  oracle_fingerprint: "",
  oracle_region: "ap-mumbai-1",
  oracle_namespace: "",
  oracle_bucket: "",
  oracle_private_key_set: false,
};

export default function OracleStorageMonitor() {
  const [cfg, setCfg] = useState<OracleConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [parUrl, setParUrl] = useState<string | null>(null);
  const [creatingPar, setCreatingPar] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_config")
        .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket, oracle_private_key_set")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setCfg({
          oracle_tenancy_ocid: data.oracle_tenancy_ocid ?? "",
          oracle_user_ocid: data.oracle_user_ocid ?? "",
          oracle_fingerprint: data.oracle_fingerprint ?? "",
          oracle_region: data.oracle_region ?? "ap-mumbai-1",
          oracle_namespace: data.oracle_namespace ?? "",
          oracle_bucket: data.oracle_bucket ?? "",
          oracle_private_key_set: !!data.oracle_private_key_set,
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_config").upsert(
      { id: true, ...cfg },
      { onConflict: "id" },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Oracle config saved");
  };

  const testConnection = async () => {
    setTesting(true); setTestResult(null);
    const { data, error } = await supabase.functions.invoke("oracle-proxy", {
      body: { action: "test" },
    });
    setTesting(false);
    if (error) { setTestResult({ ok: false, msg: error.message }); return; }
    setTestResult({ ok: !!data?.ok, msg: data?.ok ? `Reached bucket "${data.bucket}" in ${data.region}` : data?.error ?? "Unknown error" });
  };

  const createPar = async () => {
    setCreatingPar(true); setParUrl(null);
    const { data, error } = await supabase.functions.invoke("oracle-proxy", {
      body: {
        action: "create-par",
        name: `camera-ingest-${Date.now()}`,
        objectName: "ingest/",
        accessType: "AnyObjectWrite",
      },
    });
    setCreatingPar(false);
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error ?? "Failed to create PAR");
      return;
    }
    setParUrl(data.url);
    toast.success("PAR URL created (valid for 7 days)");
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
        <div className="flex items-center gap-1.5 text-xs">
          <KeyRound className="w-3.5 h-3.5" />
          {cfg.oracle_private_key_set ? (
            <span className="text-emerald-400">Private key configured</span>
          ) : (
            <span className="text-amber-400">Private key not yet marked configured</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tenancy OCID" value={cfg.oracle_tenancy_ocid} onChange={v => setCfg({ ...cfg, oracle_tenancy_ocid: v })} placeholder="ocid1.tenancy.oc1..." />
            <Field label="User OCID" value={cfg.oracle_user_ocid} onChange={v => setCfg({ ...cfg, oracle_user_ocid: v })} placeholder="ocid1.user.oc1..." />
            <Field label="Key Fingerprint" value={cfg.oracle_fingerprint} onChange={v => setCfg({ ...cfg, oracle_fingerprint: v })} placeholder="aa:bb:cc:..." />
            <Field label="Region" value={cfg.oracle_region} onChange={v => setCfg({ ...cfg, oracle_region: v })} placeholder="ap-mumbai-1" />
            <Field label="Namespace" value={cfg.oracle_namespace} onChange={v => setCfg({ ...cfg, oracle_namespace: v })} placeholder="axxxxxxxxxx" />
            <Field label="Bucket" value={cfg.oracle_bucket} onChange={v => setCfg({ ...cfg, oracle_bucket: v })} placeholder="streamvista-media" />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={cfg.oracle_private_key_set}
              onChange={e => setCfg({ ...cfg, oracle_private_key_set: e.target.checked })}
            />
            I have set the <span className="font-mono text-foreground">ORACLE_PRIVATE_KEY</span> backend secret (PEM, PKCS#8)
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm disabled:opacity-60 inline-flex items-center gap-2"
            >{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>

            <button
              onClick={testConnection}
              disabled={testing}
              className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"
            >{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Test Connection</button>

            <button
              onClick={createPar}
              disabled={creatingPar}
              className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"
            >{creatingPar ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />} Create Camera Ingest URL (PAR)</button>
          </div>

          {testResult && (
            <div className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${testResult.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
              <span className="font-mono break-all">{testResult.msg}</span>
            </div>
          )}

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
        className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}
