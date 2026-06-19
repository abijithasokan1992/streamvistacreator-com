import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: claims.claims.sub,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    // Read active config (mode + key_id)
    const { data: cfg } = await admin
      .from('razorpay_config')
      .select('mode, key_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const keyId = Deno.env.get('RAZORPAY_KEY_ID') || cfg?.key_id || '';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
    const mode: 'live' | 'test' = keyId.startsWith('rzp_live_') ? 'live' : 'test';

    if (!keyId || !keySecret) {
      return json({
        status: 'disconnected',
        mode: cfg?.mode ?? mode,
        title: 'Disconnected / Fix Credentials',
        reason: 'missing_credentials',
        message: 'Razorpay Key ID or Key Secret is not configured.',
        actions: [
          'Open Finance → Razorpay Credentials',
          'Add a valid Key ID and Key Secret',
          'Save and re-run this check',
        ],
        webhook_configured: !!webhookSecret,
      });
    }

    // Hit a lightweight authenticated endpoint. /v1/payments?count=1 always returns
    // a structured response when credentials are valid and a 401 when they are not.
    const t0 = Date.now();
    const basic = btoa(`${keyId}:${keySecret}`);
    let resp: Response;
    try {
      resp = await fetch('https://api.razorpay.com/v1/payments?count=1', {
        headers: { Authorization: `Basic ${basic}` },
      });
    } catch (e) {
      return json({
        status: 'disconnected',
        mode,
        title: 'Disconnected / Fix Credentials',
        reason: 'network_error',
        message: `Could not reach Razorpay API: ${(e as Error).message}`,
        actions: ['Check outbound network', 'Retry in a few seconds'],
        webhook_configured: !!webhookSecret,
      });
    }

    const duration = Date.now() - t0;
    const bodyText = await resp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(bodyText); } catch { /* ignore */ }

    if (resp.ok) {
      return json({
        status: 'connected',
        mode,
        title: mode === 'live' ? 'Connected (Live)' : 'Connected (Test)',
        key_id_masked: maskKey(keyId),
        webhook_configured: !!webhookSecret,
        latency_ms: duration,
        warnings: webhookSecret
          ? []
          : ['Webhook Secret is not configured — webhook signature verification will fail.'],
      });
    }

    // Map common Razorpay error codes to actionable hints.
    const errCode: string = parsed?.error?.code || `HTTP_${resp.status}`;
    const errDesc: string = parsed?.error?.description || bodyText.slice(0, 200);
    const actions: string[] = [];
    let reason = 'api_error';

    if (resp.status === 401 || /authentication/i.test(errDesc)) {
      reason = 'invalid_credentials';
      actions.push(
        'The Key ID and Key Secret do not match an active Razorpay account.',
        'Regenerate the API key pair in the Razorpay Dashboard → Settings → API Keys.',
        'Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then re-run this check.',
      );
    } else if (resp.status === 403) {
      reason = 'forbidden';
      actions.push(
        'The key exists but is not authorised for this endpoint.',
        'Confirm the account is activated and not in restricted mode.',
      );
    } else if (resp.status === 429) {
      reason = 'rate_limited';
      actions.push('Razorpay is rate-limiting requests. Wait a minute and retry.');
    } else {
      actions.push(
        `Razorpay returned ${errCode}: ${errDesc}`,
        'Check the Razorpay Dashboard status page for incidents.',
      );
    }

    if (!webhookSecret) {
      actions.push('Webhook Secret is missing — set RAZORPAY_WEBHOOK_SECRET to receive payment events.');
    }

    return json({
      status: 'disconnected',
      mode,
      title: 'Disconnected / Fix Credentials',
      reason,
      error_code: errCode,
      error_description: errDesc,
      http_status: resp.status,
      key_id_masked: maskKey(keyId),
      webhook_configured: !!webhookSecret,
      actions,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function maskKey(k: string) {
  if (k.length < 10) return '****';
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
