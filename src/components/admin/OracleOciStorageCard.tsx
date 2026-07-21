import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, Lock, Unlock, AlertTriangle, Cloud, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OciPublicConfig {
  tenancyOcid: string;
  userOcid: string;
  keyFingerprint: string;
  region: string;
  namespace: string;
  bucketName: string;
}

interface EdgeFnLog {
  ts: string;
  name: string;
  durationMs: number;
  status: number | null;
  request: unknown;
  response: unknown;
  error: string | null;
}

/**
 * Oracle OCI Storage configuration card.
 *
 * Single source of truth: `site_config` (row id=true) — the same table the
 * upload edge functions read via `_shared/oci.ts::loadOciConfig`. The private
 * key + user OCID + region backend secrets are surfaced here so admins know
 * what's missing without hunting through Project Settings.
 *
 * Legacy `admin_settings.oci_config_public` values (if present) are migrated
 * into `site_config` on first load.
 */
export default function OracleOciStorageCard() {
  const [config, setConfig] = useState<OciPublicConfig>({
    tenancyOcid: "",
    userOcid: "",
    keyFingerprint: "",
    region: "",
    namespace: "",
    bucketName: "",
  });
  const [isLocked, setIsLocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"IDLE" | "GREEN" | "RED">("IDLE");
  const [uiMessage, setUiMessage] = useState("");
  const [lastLog, setLastLog] = useState<EdgeFnLog | null>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [privateKeyPresent, setPrivateKeyPresent] = useState<boolean | null>(null);
  const [userOcidSecretPresent, setUserOcidSecretPresent] = useState<boolean | null>(null);
  const [regionSecretPresent, setRegionSecretPresent] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // 1. Try site_config first (single source of truth).
      const { data: cfg } = await (supabase as any)
        .from("site_config")
        .select(
          "oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket, oracle_private_key_set",
        )
        .eq("id", true)
        .maybeSingle();

      let next: OciPublicConfig = {
        tenancyOcid: cfg?.oracle_tenancy_ocid ?? "",
        userOcid: cfg?.oracle_user_ocid ?? "",
        keyFingerprint: cfg?.oracle_fingerprint ?? "",
        region: cfg?.oracle_region ?? "",
        namespace: cfg?.oracle_namespace ?? "",
        bucketName: cfg?.oracle_bucket ?? "",
      };

      // 2. One-time migration from the legacy admin_settings row.
      const missingCore = !next.tenancyOcid || !next.keyFingerprint || !next.namespace || !next.bucketName;
      if (missingCore) {
        const { data: legacy } = await (supabase as any)
          .from("admin_settings")
          .select("value")
          .eq("key", "oci_config_public")
          .maybeSingle();
        const v = legacy?.value as Partial<OciPublicConfig> | null;
        if (v) {
          next = {
            tenancyOcid: next.tenancyOcid || v.tenancyOcid || "",
            userOcid: next.userOcid || v.userOcid || "",
            keyFingerprint: next.keyFingerprint || v.keyFingerprint || "",
            region: next.region || v.region || "",
            namespace: next.namespace || v.namespace || "",
            bucketName: next.bucketName || v.bucketName || "",
          };
          // Best-effort sync back into site_config so uploads pick it up.
          if (next.tenancyOcid && next.namespace && next.bucketName) {
            await (supabase as any).from("site_config").upsert({
              id: true,
              oracle_tenancy_ocid: next.tenancyOcid,
              oracle_user_ocid: next.userOcid,
              oracle_fingerprint: next.keyFingerprint,
              oracle_region: next.region,
              oracle_namespace: next.namespace,
              oracle_bucket: next.bucketName,
            });
          }
        }
      }

      setConfig(next);
      setPrivateKeyPresent(Boolean(cfg?.oracle_private_key_set));
      // We can only infer secret presence server-side via a verify call.
      // Assume present until verify says otherwise.
      setUserOcidSecretPresent(null);
      setRegionSecretPresent(null);
      if (next.tenancyOcid && next.namespace && next.bucketName) {
        setIsLocked(true);
        setConnectionStatus("GREEN");
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSaveAndVerify = async () => {
    if (!config.tenancyOcid || !config.userOcid || !config.keyFingerprint || !config.region || !config.namespace || !config.bucketName) {
      setConnectionStatus("RED");
      setUiMessage("All six fields are required (Tenancy OCID, User OCID, Fingerprint, Region, Namespace, Bucket) before verifying.");
      return;
    }
    setIsVerifying(true);
    setUiMessage("Saving configuration and verifying connection…");
    const startedAt = performance.now();
    const log: EdgeFnLog = {
      ts: new Date().toISOString(),
      name: "verify-oci-connection",
      durationMs: 0,
      status: null,
      request: { ...config },
      response: null,
      error: null,
    };
    try {
      // 1. Persist to site_config FIRST — single source of truth.
      const { error: cfgErr } = await (supabase as any)
        .from("site_config")
        .upsert({
          id: true,
          oracle_tenancy_ocid: config.tenancyOcid,
          oracle_user_ocid: config.userOcid,
          oracle_fingerprint: config.keyFingerprint,
          oracle_region: config.region,
          oracle_namespace: config.namespace,
          oracle_bucket: config.bucketName,
        });
      if (cfgErr) throw cfgErr;

      // 2. Verify against OCI using the values now sitting in site_config.
      const { data, error } = await supabase.functions.invoke("verify-oci-connection", {
        body: { ...config },
      });
      log.durationMs = Math.round(performance.now() - startedAt);
      if (error) {
        log.status = (error as any).status ?? null;
        log.error = error.message ?? String(error);
        throw error;
      }
      log.response = data ?? null;
      const env = (data as any)?.environment;
      if (env) {
        setPrivateKeyPresent(!!env.OCI_PRIVATE_KEY);
        setUserOcidSecretPresent(!!env.OCI_USER_OCID);
        setRegionSecretPresent(!!env.OCI_REGION);
      }
      if (data && (data as any).error) {
        log.error = (data as any).error;
        throw new Error((data as any).error);
      }

      setConnectionStatus("GREEN");
      setIsLocked(true);
      setUiMessage("Connection verified. Configuration saved to site_config and locked.");
    } catch (err: any) {
      log.durationMs = Math.round(performance.now() - startedAt);
      if (!log.error) log.error = err?.message ?? String(err);
      setConnectionStatus("RED");
      const msg = err?.message ?? "Unknown error";
      setUiMessage(`Verification failed: ${msg}`);
    } finally {
      setIsVerifying(false);
      setLastLog(log);
    }
  };

  const unlock = () => {
    setIsLocked(false);
    setConnectionStatus("IDLE");
    setUiMessage("Fields unlocked. Re-verification required after changes.");
  };

  const field = (label: string, key: keyof OciPublicConfig, placeholder?: string) => (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">{label}</label>
      <input
        value={config[key]}
        disabled={isLocked || isVerifying}
        placeholder={placeholder}
        onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
        className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );

  const missingSecrets: string[] = [];
  if (privateKeyPresent === false) missingSecrets.push("ORACLE_PRIVATE_KEY");
  if (userOcidSecretPresent === false) missingSecrets.push("OCI_USER_OCID");
  if (regionSecretPresent === false) missingSecrets.push("OCI_REGION");

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-cyan-400" />
          <h2 className="font-display text-xl font-bold">Oracle OCI Storage Configuration</h2>
        </div>
        {connectionStatus === "GREEN" && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
            <ShieldCheck className="w-3.5 h-3.5" /> ● Connection Secure (Locked)
          </span>
        )}
        {connectionStatus === "RED" && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/40">
            <AlertTriangle className="w-3.5 h-3.5" /> ● Verification Failed
          </span>
        )}
      </div>

      {missingSecrets.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 font-mono flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            Missing backend {missingSecrets.length === 1 ? "secret" : "secrets"}:{" "}
            <code className="text-amber-100">{missingSecrets.join(", ")}</code>. Uploads will fail with
            "OCI not fully configured" until these are set in Project Settings → Secrets.
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 grid place-items-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {field("Tenancy OCID", "tenancyOcid", "ocid1.tenancy.oc1..…")}
            {field("User OCID", "userOcid", "ocid1.user.oc1..…")}
            {field("Key Fingerprint", "keyFingerprint", "aa:bb:cc:dd:…")}
            {field("Region", "region", "ap-mumbai-1")}
            {field("Namespace", "namespace", "your-namespace")}
            {field("Bucket Name", "bucketName", "your-bucket")}
          </div>

          <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-md px-3 py-2">
            🔒 Private key is managed as the <code className="text-cyan-300">ORACLE_PRIVATE_KEY</code> backend secret.
            Set it in Project Settings → Secrets — it cannot be stored in this table for security reasons.
          </p>

          {uiMessage && (
            <p
              className={`text-xs font-mono ${
                connectionStatus === "RED"
                  ? "text-destructive"
                  : connectionStatus === "GREEN"
                  ? "text-emerald-300"
                  : "text-muted-foreground"
              }`}
            >
              {uiMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {isLocked ? (
              <button
                onClick={unlock}
                className="px-4 py-2 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-xs font-mono rounded transition-all inline-flex items-center gap-2"
              >
                <Unlock className="w-3.5 h-3.5" /> Modify Credentials
              </button>
            ) : (
              <button
                onClick={handleSaveAndVerify}
                disabled={isVerifying}
                className="px-4 py-2 bg-gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 text-xs font-mono rounded transition-all inline-flex items-center gap-2 glow-primary"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying &amp; Saving…
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Save &amp; Verify Connection
                  </>
                )}
              </button>
            )}
          </div>

          {lastLog && (
            <div className="mt-2 rounded-xl border border-border bg-black/40 overflow-hidden">
              <button
                onClick={() => setShowLogDetails((s) => !s)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-accent" />
                  <span className="text-xs font-mono font-semibold">Edge Function Debug</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {lastLog.name} · {new Date(lastLog.ts).toLocaleTimeString()}
                  </span>
                </div>
                {showLogDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showLogDetails && (
                <pre className="text-[10px] font-mono p-3 overflow-auto text-muted-foreground max-h-64">
                  {JSON.stringify(lastLog, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
