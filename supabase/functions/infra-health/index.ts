// Infrastructure Health probes for the StreamVista Admin.
// Admin-only. Live checks — no cached UI state.
//
// Aggregates:
//   - Database + admin RPC (admin_infra_snapshot)
//   - Storage bucket reachability (OCI is checked via existing oracle-proxy)
//   - Email domain / queue depth (via admin_infra_snapshot cron+pgmq)
//   - AI Gateway ping (Lovable AI Gateway) using LOVABLE_API_KEY
//   - MCP endpoint HEAD
//   - Edge function deploy status via internal fetch
//   - Auth service health
//
// Each service returns:
//   { id, label, category, status, response_ms, last_checked,
//     last_failure, error, suggested_action, detail }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

type Status = 'healthy' | 'warning' | 'critical' | 'unknown';
type Check = {
  id: string;
  label: string;
  category: string;
  status: Status;
  response_ms: number | null;
  last_checked: string;
  last_failure: string | null;
  error: string | null;
  suggested_action: string | null;
  detail?: Record<string, unknown>;
};

function nowIso() { return new Date().toISOString(); }

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number; error: string | null }> {
  const t0 = performance.now();
  try {
    const value = await fn();
    return { value, ms: Math.round(performance.now() - t0), error: null };
  } catch (e) {
    return { value: null, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const anon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await anon.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: isSuper } = await admin.rpc('has_role', { _user_id: userId, _role: 'super_admin' });
    if (!isAdmin && !isSuper) return json({ error: 'Forbidden' }, 403);

    const checks: Check[] = [];
    const add = (c: Check) => checks.push(c);

    // ── 1) Database ping ───────────────────────────────────────
    {
      const r = await timed(async () => {
        const { error } = await admin.from('site_config').select('id').limit(1);
        if (error) throw new Error(error.message);
        return true;
      });
      add({
        id: 'database',
        label: 'Database',
        category: 'core',
        status: r.error ? 'critical' : r.ms > 800 ? 'warning' : 'healthy',
        response_ms: r.ms,
        last_checked: nowIso(),
        last_failure: r.error ? nowIso() : null,
        error: r.error,
        suggested_action: r.error
          ? 'Check Lovable Cloud database status. If saturated, upsize the database server.'
          : r.ms > 800 ? 'Latency elevated — inspect slow queries via the admin performance tool.' : null,
      });
    }

    // ── 2) Auth service ───────────────────────────────────────
    {
      const r = await timed(async () => {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
          headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')! },
        });
        if (!resp.ok) throw new Error(`auth health HTTP ${resp.status}`);
        await resp.text();
        return true;
      });
      add({
        id: 'auth',
        label: 'Auth Service',
        category: 'core',
        status: r.error ? 'critical' : 'healthy',
        response_ms: r.ms,
        last_checked: nowIso(),
        last_failure: r.error ? nowIso() : null,
        error: r.error,
        suggested_action: r.error ? 'Auth API unreachable. Retry; if persistent, contact platform support.' : null,
      });
    }

    // ── 3) admin_infra_snapshot (cron + pgmq + queue depths + last errors) ─
    const snap = await timed(async () => {
      const { data, error } = await admin.rpc('admin_infra_snapshot');
      if (error) throw new Error(error.message);
      return data as any;
    });

    // ── 4) Cron jobs ─────────────────────────────────────────
    {
      const jobs = (snap.value?.cron_jobs ?? []) as any[];
      const inactive = Array.isArray(jobs) ? jobs.filter(j => j?.active === false) : [];
      const failed = Array.isArray(jobs) ? jobs.filter(j => j?.last_status === 'failed') : [];
      const status: Status = snap.error ? 'unknown'
        : failed.length > 0 ? 'critical'
        : inactive.length > 0 ? 'warning'
        : jobs.length === 0 ? 'warning' : 'healthy';
      add({
        id: 'cron',
        label: 'Cron Jobs',
        category: 'jobs',
        status,
        response_ms: snap.ms,
        last_checked: nowIso(),
        last_failure: failed[0]?.last_end ?? null,
        error: snap.error,
        suggested_action: failed.length > 0
          ? `Cron job "${failed[0]?.jobname}" failed on last run — inspect edge function logs.`
          : inactive.length > 0
            ? `${inactive.length} cron job(s) inactive — re-enable via infrastructure setup.`
            : null,
        detail: { total: jobs.length, inactive: inactive.length, failed_last: failed.length },
      });
    }

    // ── 5) Email queue depths + DLQ ─────────────────────────
    {
      const qd = (snap.value?.queue_depths ?? {}) as Record<string, number>;
      const dq = (snap.value?.dlq_counts ?? {}) as Record<string, number>;
      const emailBacklog = (qd.auth_emails ?? 0) + (qd.transactional_emails ?? 0);
      const emailDlq = (dq.auth_emails ?? 0) + (dq.transactional_emails ?? 0);
      add({
        id: 'email_queue',
        label: 'Email Queue',
        category: 'queues',
        status: emailDlq > 0 ? 'critical' : emailBacklog > 100 ? 'warning' : 'healthy',
        response_ms: snap.ms,
        last_checked: nowIso(),
        last_failure: snap.value?.email?.last_error?.created_at ?? null,
        error: snap.value?.email?.last_error?.error ?? null,
        suggested_action: emailDlq > 0
          ? `${emailDlq} email(s) in DLQ. The retry-failed-emails cron drains DLQ every 5 min; open the Email Log to inspect.`
          : emailBacklog > 100 ? 'Queue backlog rising — inspect process-email-queue logs.' : null,
        detail: { backlog: emailBacklog, dlq: emailDlq, failed_24h: snap.value?.email?.failed_24h ?? 0 },
      });
    }

    // ── 6) Upload queue / ingest failures ──────────────────
    {
      const uploads = snap.value?.uploads ?? {};
      const failed24 = uploads.failed_24h ?? 0;
      const stale = uploads.stale_inflight ?? 0;
      add({
        id: 'upload_queue',
        label: 'Upload Queue',
        category: 'queues',
        status: failed24 > 20 || stale > 5 ? 'critical'
          : failed24 > 0 || stale > 0 ? 'warning' : 'healthy',
        response_ms: snap.ms,
        last_checked: nowIso(),
        last_failure: uploads.last_error?.updated_at ?? null,
        error: uploads.last_error?.error ?? null,
        suggested_action: stale > 0
          ? 'Stale in-flight uploads detected — the retry-failed-uploads cron will requeue in ≤5 min; use Failed Uploads Inspector to force-cancel.'
          : failed24 > 0 ? 'Failed uploads in last 24h — open Failed Uploads Inspector for structural diagnostic.' : null,
        detail: { failed_24h: failed24, stale_inflight: stale, last_diagnostic: uploads.last_error?.diagnostic ?? null },
      });
    }

    // ── 7) OCI Object Storage (via oracle-proxy self-check) ─
    {
      const r = await timed(async () => {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/oracle-proxy`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ action: 'health' }),
        });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`oracle-proxy HTTP ${resp.status}: ${txt.slice(0, 160)}`);
        return txt;
      });
      add({
        id: 'oci_storage',
        label: 'OCI Object Storage',
        category: 'storage',
        status: r.error ? 'critical' : r.ms > 1500 ? 'warning' : 'healthy',
        response_ms: r.ms,
        last_checked: nowIso(),
        last_failure: r.error ? nowIso() : null,
        error: r.error,
        suggested_action: r.error
          ? 'OCI unreachable via signed proxy. Verify OCI credentials in Admin → Cloud → OCI Advanced.'
          : null,
      });
    }

    // ── 8) Email Provider domain (Mailgun via Lovable) ─────
    {
      const senderDomain = Deno.env.get('SENDER_DOMAIN') ?? '';
      add({
        id: 'email_provider',
        label: 'Email Provider',
        category: 'email',
        status: senderDomain ? 'healthy' : 'warning',
        response_ms: null,
        last_checked: nowIso(),
        last_failure: null,
        error: senderDomain ? null : 'No sender domain configured',
        suggested_action: senderDomain
          ? null
          : 'Configure email domain via Admin → Platform → Email settings so app emails can send.',
        detail: { sender_domain: senderDomain || null },
      });
    }

    // ── 9) AI Gateway ping ─────────────────────────────────
    {
      const key = Deno.env.get('LOVABLE_API_KEY');
      if (!key) {
        add({
          id: 'ai_gateway', label: 'AI Gateway', category: 'ai',
          status: 'warning', response_ms: null, last_checked: nowIso(),
          last_failure: null, error: 'LOVABLE_API_KEY not configured',
          suggested_action: 'Configure LOVABLE_API_KEY in Cloud → Secrets to enable AI Gateway features.',
        });
      } else {
        const r = await timed(async () => {
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/models', {
            headers: {
              'Lovable-API-Key': key,
              Authorization: `Bearer ${key}`,
            },
          });
          await resp.text();
          // AI Gateway is reachable as long as we don't get a 5xx. 401/403 → auth issue;
          // 404 on /v1/models is treated as reachable (endpoint variant) — surface only
          // hard server errors as critical.
          if (resp.status >= 500) throw new Error(`AI gateway HTTP ${resp.status}`);
          if (resp.status === 401 || resp.status === 403) {
            throw new Error(`AI gateway auth failed (HTTP ${resp.status}) — rotate LOVABLE_API_KEY.`);
          }
          return true;
        });
        add({
          id: 'ai_gateway', label: 'AI Gateway', category: 'ai',
          status: r.error ? 'critical' : 'healthy',
          response_ms: r.ms, last_checked: nowIso(),
          last_failure: r.error ? nowIso() : null, error: r.error,
          suggested_action: r.error ? 'AI Gateway unreachable — rotate LOVABLE_API_KEY if the error is 401/403.' : null,
        });
      }
    }

    // ── 10) MCP endpoint ───────────────────────────────────
    {
      const r = await timed(async () => {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/mcp`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: authHeader,
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        await resp.text();
        if (resp.status >= 500) throw new Error(`MCP HTTP ${resp.status}`);
        return true;
      });
      add({
        id: 'mcp', label: 'MCP Server', category: 'ai',
        status: r.error ? 'critical' : 'healthy',
        response_ms: r.ms, last_checked: nowIso(),
        last_failure: r.error ? nowIso() : null, error: r.error,
        suggested_action: r.error ? 'MCP endpoint returning 5xx — check edge function logs.' : null,
      });
    }

    // ── 11) HTTPS routing / public site ────────────────────
    {
      const origin = Deno.env.get('SITE_ORIGIN')?.split(',')[0]?.trim() || '';
      if (origin) {
        const r = await timed(async () => {
          const resp = await fetch(origin, { method: 'HEAD', redirect: 'manual' });
          if (resp.status >= 500) throw new Error(`site HTTP ${resp.status}`);
          return { status: resp.status, protocol: origin.startsWith('https') };
        });
        add({
          id: 'https_routing', label: 'HTTP/HTTPS Routing', category: 'routing',
          status: r.error ? 'critical' : (r.value as any)?.protocol ? 'healthy' : 'warning',
          response_ms: r.ms, last_checked: nowIso(),
          last_failure: r.error ? nowIso() : null, error: r.error,
          suggested_action: r.error
            ? 'Public origin unreachable — check custom domain SSL provisioning.'
            : (r.value as any)?.protocol ? null : 'Origin is not HTTPS — enforce HTTPS in custom domain settings.',
          detail: { origin, http_status: (r.value as any)?.status ?? null },
        });
      }
    }

    // ── 12) Edge functions deploy status (best-effort: HEAD known fns) ─
    {
      const probes = ['process-email-queue', 'oci-multipart', 'send-transactional-email', 'admin-users'];
      let failing = 0;
      for (const fn of probes) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'OPTIONS' });
          if (resp.status >= 500) failing += 1;
        } catch { failing += 1; }
      }
      add({
        id: 'edge_functions', label: 'Edge Functions', category: 'core',
        status: failing === 0 ? 'healthy' : failing < probes.length ? 'warning' : 'critical',
        response_ms: null, last_checked: nowIso(),
        last_failure: failing > 0 ? nowIso() : null,
        error: failing > 0 ? `${failing}/${probes.length} probes failed` : null,
        suggested_action: failing > 0 ? 'Redeploy failing edge functions and check their logs.' : null,
      });
    }

    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      warning: checks.filter(c => c.status === 'warning').length,
      critical: checks.filter(c => c.status === 'critical').length,
      unknown: checks.filter(c => c.status === 'unknown').length,
    };
    return json({ checks, summary, snapshot: snap.value, generated_at: nowIso() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
