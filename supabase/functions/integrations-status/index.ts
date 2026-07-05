// Aggregated status for the Settings → Integrations page.
// Reuses existing config/secrets — never returns secret values.
// Phase 3: enriched with health, last_activity, version, permissions, docs.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

type ServiceStatus = {
  id: string;
  label: string;
  connected: boolean;
  health: 'healthy' | 'degraded' | 'unknown' | 'down';
  mode?: string;
  note?: string;
  version?: string;
  permissions?: string[];
  docs_url?: string;
  last_sync?: string;
  last_activity?: string;
  last_checked?: string;
  extra?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const now = new Date().toISOString();
    const env = (k: string) => (Deno.env.get(k) ?? '').trim();

    // ── OCI ─────────────────────────────────────────────────────
    const { data: ociCfg } = await admin
      .from('site_config')
      .select('oracle_tenancy_ocid, oracle_bucket, oracle_region, oracle_namespace, updated_at')
      .eq('id', true)
      .maybeSingle();
    const ociConnected =
      !!(ociCfg?.oracle_tenancy_ocid && ociCfg?.oracle_bucket) &&
      !!(env('ORACLE_PRIVATE_KEY') || env('OCI_PRIVATE_KEY'));

    // OCI activity: recent uploads + active count.
    let ociExtra: Record<string, unknown> = {};
    let ociLastActivity: string | undefined;
    try {
      const [{ data: usedRows }, { data: activeRows }, { data: lastRow }] = await Promise.all([
        admin.from('recent_uploads').select('size_bytes').limit(5000),
        admin.from('recent_uploads').select('id', { count: 'exact', head: true }).eq('status', 'uploading'),
        admin.from('recent_uploads').select('created_at').order('created_at', { ascending: false }).limit(1),
      ]);
      const used = (usedRows ?? []).reduce(
        (n: number, r: { size_bytes?: number | null }) => n + (Number(r.size_bytes) || 0),
        0,
      );
      ociExtra = {
        used_bytes: used,
        active_uploads: (activeRows as unknown as { count?: number } | null)?.count ?? 0,
        bucket: ociCfg?.oracle_bucket ?? null,
        region: ociCfg?.oracle_region ?? null,
        namespace: ociCfg?.oracle_namespace ?? null,
        archive_bucket: env('ORACLE_ARCHIVE_BUCKET') || null,
      };
      ociLastActivity = lastRow?.[0]?.created_at as string | undefined;
    } catch (_) { /* ignore */ }

    // ── Razorpay ────────────────────────────────────────────────
    const rzpKey = env('RAZORPAY_KEY_ID');
    const rzpSecret = env('RAZORPAY_KEY_SECRET');
    const { data: rzpCfg } = await admin
      .from('razorpay_config')
      .select('mode, updated_at')
      .eq('id', true)
      .maybeSingle();
    const rzpConnected = !!(rzpKey && rzpSecret);

    let rzpLastActivity: string | undefined;
    try {
      const { data: lastInv } = await admin
        .from('invoices')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      rzpLastActivity = lastInv?.[0]?.created_at as string | undefined;
    } catch (_) { /* ignore */ }

    const services: ServiceStatus[] = [
      {
        id: 'oracle',
        label: 'Oracle Cloud (OCI)',
        connected: ociConnected,
        health: ociConnected ? 'healthy' : 'down',
        version: 'v3 signing',
        permissions: ['object:read', 'object:write', 'object:archive'],
        docs_url: 'https://docs.oracle.com/en-us/iaas/Content/Object/home.htm',
        note: ociConnected
          ? `Bucket ${ociCfg!.oracle_bucket} · ${ociCfg!.oracle_region}`
          : 'Missing OCI credentials or bucket configuration.',
        last_sync: ociCfg?.updated_at ?? now,
        last_activity: ociLastActivity,
        last_checked: now,
        extra: ociExtra,
      },
      {
        id: 'gpt55',
        label: 'GPT-5.5 · Orchestration',
        connected: !!env('LOVABLE_API_KEY'),
        health: env('LOVABLE_API_KEY') ? 'healthy' : 'down',
        version: 'gpt-5.5',
        permissions: ['reasoning', 'summaries', 'assistant', 'search'],
        docs_url: 'https://ai-sdk.dev/docs/introduction',
        note: env('LOVABLE_API_KEY')
          ? 'Orchestration and reasoning layer for the assistant.'
          : 'LOVABLE_API_KEY not configured.',
        last_checked: now,
      },
      {
        id: 'gemini_enterprise',
        label: 'Gemini Enterprise',
        connected: !!env('GEMINI_ENTERPRISE_API_KEY') || !!env('LOVABLE_API_KEY'),
        health: (env('GEMINI_ENTERPRISE_API_KEY') || env('LOVABLE_API_KEY')) ? 'healthy' : 'down',
        version: 'gemini-2.5-pro',
        permissions: ['ocr', 'speech-to-text', 'subtitles', 'translation', 'metadata', 'vision'],
        docs_url: 'https://ai.google.dev/gemini-api/docs',
        note: 'OCR, speech-to-text, subtitles, translation, metadata & image understanding.',
        last_checked: now,
      },
      {
        id: 'firecrawl',
        label: 'Firecrawl · Research',
        connected: !!env('FIRECRAWL_API_KEY'),
        health: env('FIRECRAWL_API_KEY') ? 'healthy' : 'down',
        version: 'v2',
        permissions: ['search', 'scrape', 'map'],
        docs_url: 'https://docs.firecrawl.dev/api-reference/v2-introduction',
        note: env('FIRECRAWL_API_KEY')
          ? 'Companies, distributors, OTT, broadcasters, festivals, markets, studios.'
          : 'Not connected. Link the Firecrawl connector.',
        last_checked: now,
      },
      {
        id: 'razorpay',
        label: 'Razorpay · Billing',
        connected: rzpConnected,
        health: rzpConnected ? 'healthy' : 'down',
        mode: rzpCfg?.mode ?? (rzpConnected ? 'test' : undefined),
        version: 'v1',
        permissions: ['orders', 'subscriptions', 'invoices', 'webhooks'],
        docs_url: 'https://razorpay.com/docs/api/',
        note: rzpConnected
          ? 'Subscriptions, storage plans, invoices, payment status.'
          : 'Missing Razorpay API credentials.',
        last_sync: rzpCfg?.updated_at ?? now,
        last_activity: rzpLastActivity,
        last_checked: now,
      },
      {
        id: 'github',
        label: 'GitHub',
        connected: true,
        health: 'healthy',
        version: 'app-sync',
        permissions: ['repo:read', 'workflows:read'],
        docs_url: 'https://docs.github.com/en/rest',
        note: 'Repository synced via Lovable ↔ GitHub. Read-only.',
        last_checked: now,
        extra: {
          repository: env('GITHUB_REPOSITORY') || 'streamvista/cloud-x',
          branch: env('GITHUB_REF_NAME') || 'main',
        },
      },
      {
        id: 'gatewayapi',
        label: 'GatewayAPI · SMS / RCS',
        connected: !!env('GATEWAYAPI_API_KEY'),
        health: env('GATEWAYAPI_API_KEY') ? 'healthy' : 'down',
        version: 'mobile v1',
        permissions: ['sms:send', 'rcs:send', 'otp:send'],
        docs_url: 'https://gatewayapi.com/docs/',
        note: env('GATEWAYAPI_API_KEY')
          ? 'SMS · RCS · OTP · editorial & delivery notifications. Email fallback via transactional pipeline.'
          : 'Not connected. Link the GatewayAPI connector.',
        last_checked: now,
        extra: { sms: true, rcs: true, email_fallback: true },
      },
      {
        id: 'gmail',
        label: 'Gmail · Transactional',
        connected: !!(env('RESEND_API_KEY') || env('SENDGRID_API_KEY') || env('SMTP_HOST') || env('GMAIL_API_KEY')),
        health: (env('RESEND_API_KEY') || env('SENDGRID_API_KEY') || env('SMTP_HOST') || env('GMAIL_API_KEY')) ? 'healthy' : 'down',
        version: 'v1',
        permissions: ['send:transactional'],
        docs_url: 'https://developers.google.com/gmail/api',
        note: 'Verification, invitations, password reset, billing, collaboration. Mailbox contents are never exposed.',
        last_checked: now,
        extra: {
          notifications: true,
          invitations: true,
          password_reset: true,
          billing_emails: true,
        },
      },
      {
        id: 'sanity',
        label: 'Sanity CMS · Public content',
        connected: !!env('SANITY_API_KEY') || !!env('SANITY_PROJECT_ID'),
        health: (env('SANITY_API_KEY') || env('SANITY_PROJECT_ID')) ? 'healthy' : 'unknown',
        version: 'v2024-01-01',
        permissions: ['homepage', 'marketing', 'documentation', 'news', 'help-center'],
        docs_url: 'https://www.sanity.io/docs',
        note: 'Public content only. Production data never lives in the CMS.',
        last_checked: now,
      },
    ];

    return json({ services, checked_at: now });
  } catch (e) {
    console.error('integrations-status error', e);
    return json({ error: 'internal_error', message: (e as Error).message }, 500);
  }
});
