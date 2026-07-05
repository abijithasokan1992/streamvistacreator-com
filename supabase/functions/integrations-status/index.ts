// Aggregated status for the Settings → Integrations page.
// Reuses existing config/secrets — never returns secret values.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

type ServiceStatus = {
  id: string;
  label: string;
  connected: boolean;
  mode?: string;
  note?: string;
  last_checked?: string;
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

    // OCI — presence of the site_config row + private key secret.
    const { data: ociCfg } = await admin
      .from('site_config')
      .select('oracle_tenancy_ocid, oracle_bucket, oracle_region, updated_at')
      .eq('id', true)
      .maybeSingle();
    const ociConnected =
      !!(ociCfg?.oracle_tenancy_ocid && ociCfg?.oracle_bucket) &&
      !!(env('ORACLE_PRIVATE_KEY') || env('OCI_PRIVATE_KEY'));

    // Razorpay — env keys + optional DB config row.
    const rzpKey = env('RAZORPAY_KEY_ID');
    const rzpSecret = env('RAZORPAY_KEY_SECRET');
    const { data: rzpCfg } = await admin
      .from('razorpay_config')
      .select('mode, updated_at')
      .eq('id', true)
      .maybeSingle();
    const rzpConnected = !!(rzpKey && rzpSecret);

    const services: ServiceStatus[] = [
      {
        id: 'oracle',
        label: 'Oracle Cloud (OCI)',
        connected: ociConnected,
        note: ociConnected
          ? `Bucket ${ociCfg!.oracle_bucket} · ${ociCfg!.oracle_region}`
          : 'Missing OCI credentials or bucket configuration.',
        last_checked: ociCfg?.updated_at ?? now,
      },
      {
        id: 'gpt55',
        label: 'GPT-5.5 (via Lovable AI)',
        connected: !!env('LOVABLE_API_KEY'),
        note: env('LOVABLE_API_KEY')
          ? 'Routed through Lovable AI Gateway.'
          : 'LOVABLE_API_KEY not configured.',
        last_checked: now,
      },
      {
        id: 'gemini_enterprise',
        label: 'Gemini Enterprise',
        connected: !!env('GEMINI_ENTERPRISE_API_KEY'),
        note: env('GEMINI_ENTERPRISE_API_KEY')
          ? 'Connector linked. Used for semantic search & grounded answers.'
          : 'Not connected. Link the Gemini Enterprise connector.',
        last_checked: now,
      },
      {
        id: 'firecrawl',
        label: 'Firecrawl',
        connected: !!env('FIRECRAWL_API_KEY'),
        note: env('FIRECRAWL_API_KEY')
          ? 'Used for research: companies, OTT, festivals, industry news.'
          : 'Not connected. Link the Firecrawl connector.',
        last_checked: now,
      },
      {
        id: 'razorpay',
        label: 'Razorpay',
        connected: rzpConnected,
        mode: rzpCfg?.mode ?? (rzpConnected ? 'test' : undefined),
        note: rzpConnected
          ? 'Subscriptions, storage plans, invoices.'
          : 'Missing Razorpay API credentials.',
        last_checked: rzpCfg?.updated_at ?? now,
      },
      {
        id: 'github',
        label: 'GitHub',
        connected: true,
        note: 'Repository synced via Lovable ↔ GitHub. Internal use only.',
        last_checked: now,
      },
      {
        id: 'gatewayapi',
        label: 'GatewayAPI (SMS · RCS · OTP)',
        connected: !!env('GATEWAYAPI_API_KEY'),
        note: env('GATEWAYAPI_API_KEY')
          ? 'Used for SMS, RCS, OTP, editorial & delivery notifications.'
          : 'Not connected. Link the GatewayAPI connector.',
        last_checked: now,
      },
      {
        id: 'gmail',
        label: 'Gmail / Transactional Email',
        connected: !!(env('RESEND_API_KEY') || env('SENDGRID_API_KEY') || env('SMTP_HOST')),
        note: 'Verification, invitations, password reset, billing & collaboration.',
        last_checked: now,
      },
      {
        id: 'sanity',
        label: 'Sanity CMS (public content)',
        connected: !!env('SANITY_API_KEY'),
        note: env('SANITY_API_KEY')
          ? 'Homepage, marketing pages, docs, news, help centre.'
          : 'Not connected. Productions & assets never live in the CMS.',
        last_checked: now,
      },
    ];

    return json({ services, checked_at: now });
  } catch (e) {
    console.error('integrations-status error', e);
    return json({ error: 'internal_error', message: (e as Error).message }, 500);
  }
});
