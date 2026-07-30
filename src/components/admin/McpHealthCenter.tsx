import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Server,
  Copy,
  ExternalLink,
  KeyRound,
  FileJson,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

type Status = "pass" | "warn" | "fail" | "pending";

interface CheckResult {
  id: string;
  label: string;
  hint: string;
  status: Status;
  detail?: string;
  meta?: Record<string, string | number>;
  icon: JSX.Element;
}

interface OAuthAttempt {
  id: string;
  created_at: string;
  action: string;
  resource: string | null;
  allowed: boolean;
  permission_key: string | null;
  actor_email: string | null;
  details: Record<string, unknown> | null;
}

const projectRef =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ??
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "");

const SUPABASE_HOST = projectRef ? `https://${projectRef}.supabase.co` : "";
const MCP_URL = SUPABASE_HOST ? `${SUPABASE_HOST}/functions/v1/mcp` : "";
const MCP_RESOURCE_META = MCP_URL ? `${MCP_URL}/.well-known/oauth-protected-resource` : "";
const OIDC_DISCOVERY = SUPABASE_HOST ? `${SUPABASE_HOST}/auth/v1/.well-known/openid-configuration` : "";
const AS_METADATA = SUPABASE_HOST ? `${SUPABASE_HOST}/auth/v1/.well-known/oauth-authorization-server` : "";

const STATUS_STYLES: Record<Status, { pill: string; icon: JSX.Element; label: string }> = {
  pass: {
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: "PASS",
  },
  warn: {
    pill: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: "WARN",
  },
  fail: {
    pill: "bg-red-500/15 text-red-300 border-red-500/30",
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: "FAIL",
  },
  pending: {
    pill: "bg-muted/40 text-muted-foreground border-border/50",
    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    label: "…",
  },
};

async function safeJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, body, headers: res.headers };
}

function categorizeAttempt(row: OAuthAttempt): string {
  if (row.allowed) return "success";
  const d = (row.details ?? {}) as Record<string, unknown>;
  const err = String(d.error ?? d.reason ?? row.permission_key ?? "").toLowerCase();
  if (!err) return "denied";
  if (err.includes("expired")) return "token_expired";
  if (err.includes("invalid") && err.includes("token")) return "invalid_token";
  if (err.includes("audience")) return "audience_mismatch";
  if (err.includes("issuer")) return "issuer_mismatch";
  if (err.includes("signature") || err.includes("jwks")) return "signature_error";
  if (err.includes("scope")) return "scope_error";
  return err.slice(0, 32);
}

export default function McpHealthCenter() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [attempts, setAttempts] = useState<OAuthAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);

  const runChecks = useCallback(async () => {
    setRunning(true);
    const results: CheckResult[] = [];

    // Do not manufacture an invalid https://undefined.supabase.co endpoint.
    // The diagnostic must name the deployment configuration problem clearly.
    if (!projectRef) {
      results.push({
        id: "configuration",
        label: "Supabase project configuration",
        hint: "VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_URL is required at build time",
        status: "fail",
        detail: "No Supabase project reference was injected into this deployment.",
        icon: <AlertTriangle className="w-4 h-4" />,
      });
      setChecks(results);
      setRunning(false);
      return;
    }

    // 1. MCP endpoint health — unauthenticated POST should be 401 with WWW-Authenticate
    try {
      const res = await fetch(MCP_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      });
      const www = res.headers.get("www-authenticate") ?? "";
      const ok = res.status === 401 && /bearer/i.test(www) && /resource_metadata/i.test(www);
      results.push({
        id: "mcp",
        label: "MCP endpoint",
        hint: "Unauthenticated request must return 401 + WWW-Authenticate",
        status: ok ? "pass" : res.status === 401 ? "warn" : "fail",
        detail: `HTTP ${res.status} · ${www || "no www-authenticate header"}`,
        meta: { url: MCP_URL },
        icon: <Server className="w-4 h-4" />,
      });
    } catch (e) {
      results.push({
        id: "mcp",
        label: "MCP endpoint",
        hint: "Reachable at /functions/v1/mcp",
        status: "fail",
        detail: (e as Error).message,
        icon: <Server className="w-4 h-4" />,
      });
    }

    // 2. Protected resource metadata (RFC 9728)
    let resourceIssuer: string | null = null;
    try {
      const { ok, status, body } = await safeJson(MCP_RESOURCE_META);
      const b = body as { resource?: string; authorization_servers?: string[] } | null;
      resourceIssuer = b?.authorization_servers?.[0] ?? null;
      const good = ok && !!b?.resource && Array.isArray(b?.authorization_servers) && b!.authorization_servers!.length > 0;
      results.push({
        id: "resource",
        label: "Protected resource metadata",
        hint: "RFC 9728 · advertises authorization server",
        status: good ? "pass" : "fail",
        detail: good
          ? `resource=${b?.resource} · as=${resourceIssuer}`
          : `HTTP ${status}`,
        icon: <ShieldCheck className="w-4 h-4" />,
      });
    } catch (e) {
      results.push({
        id: "resource",
        label: "Protected resource metadata",
        hint: "RFC 9728",
        status: "fail",
        detail: (e as Error).message,
        icon: <ShieldCheck className="w-4 h-4" />,
      });
    }

    // 3. OIDC discovery
    let jwksUri: string | null = null;
    let discoveryIssuer: string | null = null;
    try {
      const { ok, body } = await safeJson(OIDC_DISCOVERY);
      const b = body as {
        issuer?: string;
        authorization_endpoint?: string;
        token_endpoint?: string;
        jwks_uri?: string;
        code_challenge_methods_supported?: string[];
      } | null;
      jwksUri = b?.jwks_uri ?? null;
      discoveryIssuer = b?.issuer ?? null;
      const complete =
        ok && !!b?.issuer && !!b?.authorization_endpoint && !!b?.token_endpoint && !!b?.jwks_uri;
      const pkce = (b?.code_challenge_methods_supported ?? []).includes("S256");
      results.push({
        id: "oidc",
        label: "OIDC discovery",
        hint: "issuer · authorize · token · jwks · PKCE S256",
        status: complete && pkce ? "pass" : complete ? "warn" : "fail",
        detail: `issuer=${discoveryIssuer ?? "?"} · pkce=${pkce ? "S256" : "no"}`,
        icon: <FileJson className="w-4 h-4" />,
      });
    } catch (e) {
      results.push({
        id: "oidc",
        label: "OIDC discovery",
        hint: "issuer discovery",
        status: "fail",
        detail: (e as Error).message,
        icon: <FileJson className="w-4 h-4" />,
      });
    }

    // 4. OAuth authorization server metadata + DCR
    try {
      const { ok, body } = await safeJson(AS_METADATA);
      const b = body as { registration_endpoint?: string; grant_types_supported?: string[] } | null;
      const dcr = !!b?.registration_endpoint;
      const grants = b?.grant_types_supported ?? [];
      const hasCode = grants.includes("authorization_code");
      results.push({
        id: "oauth-config",
        label: "OAuth configuration",
        hint: "authorization_code grant + dynamic client registration",
        status: ok && hasCode && dcr ? "pass" : ok && hasCode ? "warn" : "fail",
        detail: `grants=${grants.join(",") || "?"} · dcr=${dcr ? "enabled" : "disabled"}`,
        icon: <KeyRound className="w-4 h-4" />,
      });
    } catch (e) {
      results.push({
        id: "oauth-config",
        label: "OAuth configuration",
        hint: "authorization server metadata",
        status: "fail",
        detail: (e as Error).message,
        icon: <KeyRound className="w-4 h-4" />,
      });
    }

    // 5. JWKS — must have an asymmetric signing key (ES256/RS256/EdDSA)
    if (jwksUri) {
      try {
        const { ok, body } = await safeJson(jwksUri);
        const keys = ((body as { keys?: Array<{ kty?: string; alg?: string }> } | null)?.keys) ?? [];
        const asymm = keys.filter((k) => k.kty && !["oct"].includes(k.kty.toLowerCase()));
        const algs = Array.from(new Set(asymm.map((k) => k.alg).filter(Boolean))).join(", ");
        results.push({
          id: "jwks",
          label: "JWKS signing keys",
          hint: "asymmetric (EC / RSA / OKP) required for MCP",
          status: ok && asymm.length > 0 ? "pass" : ok ? "warn" : "fail",
          detail: `${asymm.length} asymmetric key(s)${algs ? ` · ${algs}` : ""}`,
          icon: <KeyRound className="w-4 h-4" />,
        });
      } catch (e) {
        results.push({
          id: "jwks",
          label: "JWKS signing keys",
          hint: "asymmetric signing keys",
          status: "fail",
          detail: (e as Error).message,
          icon: <KeyRound className="w-4 h-4" />,
        });
      }
    } else {
      results.push({
        id: "jwks",
        label: "JWKS signing keys",
        hint: "asymmetric signing keys",
        status: "warn",
        detail: "jwks_uri not resolved from OIDC discovery",
        icon: <KeyRound className="w-4 h-4" />,
      });
    }

    // 6. Manifest validation
    try {
      const res = await fetch("/.lovable/mcp/manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = (await res.json()) as {
        auth?: { type?: string; issuer?: string };
        mcp?: { server?: { name?: string; version?: string }; tools?: Array<{ name: string }> };
      };
      const tools = manifest.mcp?.tools ?? [];
      const issuerMatches =
        !discoveryIssuer || !manifest.auth?.issuer || manifest.auth.issuer === discoveryIssuer;
      const good = tools.length > 0 && manifest.auth?.type === "oauth" && issuerMatches;
      results.push({
        id: "manifest",
        label: "MCP manifest",
        hint: "advertised tools + issuer alignment",
        status: good ? "pass" : "warn",
        detail: `${tools.length} tool(s) · ${manifest.mcp?.server?.name ?? "?"} v${manifest.mcp?.server?.version ?? "?"}${issuerMatches ? "" : " · issuer mismatch"}`,
        meta: { tools: tools.length },
        icon: <Wrench className="w-4 h-4" />,
      });
    } catch (e) {
      results.push({
        id: "manifest",
        label: "MCP manifest",
        hint: "manifest at /.lovable/mcp/manifest.json",
        status: "fail",
        detail: (e as Error).message,
        icon: <Wrench className="w-4 h-4" />,
      });
    }

    setChecks(results);
    setRunning(false);
  }, []);

  const loadAttempts = useCallback(async () => {
    setLoadingAttempts(true);
    const { data, error } = await supabase
      .from("mcp_audit_log")
      .select("id, created_at, action, resource, allowed, permission_key, actor_email, details")
      .or("action.ilike.oauth%,action.ilike.%auth%,action.ilike.%token%,action.ilike.%client%")
      .order("created_at", { ascending: false })
      .limit(25);
    if (!error && data) setAttempts(data as unknown as OAuthAttempt[]);
    setLoadingAttempts(false);
  }, []);

  useEffect(() => {
    runChecks();
    loadAttempts();
  }, [runChecks, loadAttempts]);

  const summary = useMemo(() => {
    if (!checks.length) return { pass: 0, warn: 0, fail: 0 };
    return checks.reduce(
      (acc, c) => {
        if (c.status === "pass") acc.pass++;
        else if (c.status === "warn") acc.warn++;
        else if (c.status === "fail") acc.fail++;
        return acc;
      },
      { pass: 0, warn: 0, fail: 0 },
    );
  }, [checks]);

  const overall: Status = summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : checks.length ? "pass" : "pending";

  const copy = (v: string) => {
    navigator.clipboard.writeText(v).then(() => toast.success("Copied"));
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 p-2.5 border border-cyan-500/30">
              <Activity className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                MCP Health Center
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLES[overall].pill}`}
                >
                  {STATUS_STYLES[overall].icon}
                  {STATUS_STYLES[overall].label}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Live health of the Model Context Protocol server, OAuth 2.1 authorization server, and advertised tool manifest. Read-only diagnostics — no auth or schema changes.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={runChecks} disabled={running} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
            Re-run checks
          </Button>
        </div>

        {/* Endpoint URLs */}
        <div className="mt-5 grid gap-2 text-xs">
          {[
            { label: "MCP URL", value: MCP_URL },
            { label: "Resource metadata", value: MCP_RESOURCE_META },
            { label: "OIDC discovery", value: OIDC_DISCOVERY },
          ].filter((r) => r.value).map((r) => (
            <div key={r.label} className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-32 shrink-0">{r.label}</span>
              <code className="font-mono text-[11px] truncate flex-1">{r.value}</code>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => copy(r.value)} aria-label="Copy">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a className="text-muted-foreground hover:text-foreground" href={r.value} target="_blank" rel="noreferrer" aria-label="Open">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>

        {/* Summary chips */}
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10">{summary.pass} PASS</Badge>
          <Badge variant="outline" className="border-amber-500/30 text-amber-300 bg-amber-500/10">{summary.warn} WARN</Badge>
          <Badge variant="outline" className="border-red-500/30 text-red-300 bg-red-500/10">{summary.fail} FAIL</Badge>
        </div>
      </div>

      {/* Check grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(checks.length ? checks : Array.from({ length: 6 }, (_, i): CheckResult => ({
          id: `p-${i}`, label: "Running…", hint: "", status: "pending", icon: <RefreshCw className="w-4 h-4 animate-spin" />,
        }))).map((c) => (
          <div key={c.id} className="rounded-xl border border-border/50 bg-background/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="text-muted-foreground shrink-0 mt-0.5">{c.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.hint}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLES[c.status].pill}`}>
                {STATUS_STYLES[c.status].icon}
                {STATUS_STYLES[c.status].label}
              </span>
            </div>
            {"detail" in c && c.detail && (
              <div className="mt-2.5 font-mono text-[11px] text-muted-foreground/80 break-words">{c.detail}</div>
            )}
          </div>
        ))}
      </div>

      {/* OAuth attempts */}
      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-300" />
              Recent OAuth authentication attempts
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last 25 entries from the MCP audit log · scoped to admin_audit_log RBAC.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadAttempts} disabled={loadingAttempts}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAttempts ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/40 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground text-[10px] uppercase tracking-wider">
              <tr className="border-b border-border/40">
                <th className="text-left px-3 py-2 font-medium">Timestamp</th>
                <th className="text-left px-3 py-2 font-medium">Client / Actor</th>
                <th className="text-left px-3 py-2 font-medium">Action</th>
                <th className="text-left px-3 py-2 font-medium">Result</th>
                <th className="text-left px-3 py-2 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {loadingAttempts ? "Loading…" : "No OAuth-related attempts recorded yet."}
                  </td>
                </tr>
              ) : (
                attempts.map((r) => {
                  const category = categorizeAttempt(r);
                  const clientId =
                    (r.details as Record<string, unknown> | null)?.client_id as string | undefined;
                  return (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-background/60">
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap tabular-nums">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[220px]">
                        {clientId ? <code className="font-mono text-[11px]">{clientId}</code> : r.actor_email ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.action}</td>
                      <td className="px-3 py-2">
                        {r.allowed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-3 h-3" /> success</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="w-3 h-3" /> failure</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{category}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
