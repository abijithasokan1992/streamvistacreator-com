// GatewayAPI SMS test — admin-only. Sends a single SMS via the connector gateway.
// Does NOT duplicate the notification pipeline; used only for the "Test connection"
// action on the Integrations dashboard.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

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

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supa.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const gatewayKey = Deno.env.get('GATEWAYAPI_API_KEY');
    if (!lovableKey || !gatewayKey) {
      return json({ error: 'gatewayapi_not_connected' }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const recipientRaw = String(body?.recipient ?? '').replace(/\D/g, '');
    const message = String(body?.message ?? 'StreamVista test notification').slice(0, 300);
    const sender = String(body?.sender ?? 'StreamVista').slice(0, 11);
    if (!recipientRaw) return json({ error: 'recipient_required' }, 400);

    const res = await fetch('https://connector-gateway.lovable.dev/gatewayapi/mobile/single', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': gatewayKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        recipient: Number(recipientRaw),
        message,
        reference: `sv-test-${Date.now()}`,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return json({ error: 'send_failed', status: res.status, detail: data }, 502);
    return json({ ok: true, result: data });
  } catch (e) {
    console.error('send-sms-test error', e);
    return json({ error: 'internal_error', message: (e as Error).message }, 500);
  }
});
