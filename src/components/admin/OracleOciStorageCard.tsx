import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, Lock, Unlock, AlertTriangle, Cloud, Terminal, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OciPublicConfig {
  tenancyOcid: string;
  keyFingerprint: string;
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
 * Oracle OCI Storage configuration card with a strict lock / modify toggle.
 *
 * - Public fields (tenancy OCID, fingerprint, namespace, bucket) are stored
 *   in the `admin_settings` table under key `oci_config_public`.
 * - The private key is NEVER stored here — it lives only in the
 *   `ORACLE_PRIVATE_KEY` backend secret and is used server-side by the
 *   `verify-oci-connection` edge function.
 * - Verifying flips the card into a locked state with a green pill; admins
 *   must explicitly hit "Modify Credentials" to edit again.
 */
export default function OracleOciStorageCard() {
  const [config, setConfig] = useState<OciPublicConfig>({
    tenancyOcid: "",
    keyFingerprint: "",
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "oci_config_public")
        .maybeSingle();
      const v = data?.value as Partial<OciPublicConfig> | null;
      if (v && (v.tenancyOcid || v.namespace || v.bucketName)) {
        setConfig({
          tenancyOcid: v.tenancyOcid ?? "",
          keyFingerprint: v.keyFingerprint ?? "",
          namespace: v.namespace ?? "",
          bucketName: v.bucketName ?? "",
        });
        setIsLocked(true);
        setConnectionStatus("GREEN");
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSaveAndVerify = async () => {
    if (!config.tenancyOcid || !config.keyFingerprint || !config.namespace || !config.bucketName) {
      setConnectionStatus("RED");
      setUiMessage("All four public fields are required before verifying.");
      return;
    }
    setIsVerifying(true);
    setUiMessage("Verifying connection with OCI Bucket…");
    try {
      const { data, error } = await supabase.functions.invoke("verify-oci-connection", {
        body: { ...config },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);

      const { error: upErr } = await supabase
        .from("admin_settings")
        .upsert({ key: "oci_config_public", value: config as any });
      if (upErr) throw upErr;

      setConnectionStatus("GREEN");
      setIsLocked(true);
      setUiMessage("Connection verified. Public fields saved and locked.");
    } catch (err: any) {
      setConnectionStatus("RED");
      const msg = err?.message ?? "Unknown error";
      setUiMessage(
        msg.toLowerCase().includes("oracle_private_key")
          ? msg
          : `Verification failed: ${msg}. Ensure ORACLE_PRIVATE_KEY is set in Backend → Secrets.`,
      );
    } finally {
      setIsVerifying(false);
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

      {isLoading ? (
        <div className="py-10 grid place-items-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {field("Tenancy OCID", "tenancyOcid", "ocid1.tenancy.oc1..…")}
            {field("Key Fingerprint", "keyFingerprint", "aa:bb:cc:dd:…")}
            {field("Namespace", "namespace", "your-namespace")}
            {field("Bucket Name", "bucketName", "your-bucket")}
          </div>

          <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-md px-3 py-2">
            🔒 Private key is managed as the <code className="text-cyan-300">ORACLE_PRIVATE_KEY</code> backend secret.
            Set it in Backend → Secrets — it cannot be stored in this table for security reasons.
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
        </>
      )}
    </div>
  );
}
