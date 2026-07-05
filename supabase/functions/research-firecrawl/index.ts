// Firecrawl research proxy for the Research Workspace.
// Admin-only. Does NOT persist results — every result must be user-reviewed
// and manually saved through existing modules.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

const CATEGORY_HINTS: Record<string, string> = {
  production_company: 'production company film studio',
  distributor: 'film distributor sales agent',
  ott: 'OTT streaming platform',
  broadcaster: 'television broadcaster network',
  festival: 'film festival',
  market: 'film market co-production market',
  studio: 'post-production studio',
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

    const key = Deno.env.get('FIRECRAWL_API_KEY');
    if (!key) return json({ error: 'firecrawl_not_connected' }, 400);

    const body = await req.json().catch(() => ({}));
    const category = String(body?.category ?? '');
    const rawQuery = String(body?.query ?? '').trim();
    if (!rawQuery) return json({ error: 'query_required' }, 400);
    const limit = Math.min(Math.max(Number(body?.limit ?? 8), 1), 15);

    const hint = CATEGORY_HINTS[category] ?? '';
    const query = hint ? `${rawQuery} ${hint}` : rawQuery;

    const res = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return json({ error: 'search_failed', status: res.status }, 502);

    const items: Array<{ title?: string; url?: string; description?: string; snippet?: string }> =
      Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.web?.results)
          ? data.web.results
          : Array.isArray(data?.results)
            ? data.results
            : [];

    return json({
      category,
      query: rawQuery,
      results: items.slice(0, limit).map((r) => ({
        title: r.title ?? r.url ?? 'Untitled',
        url: r.url,
        description: r.description ?? r.snippet ?? '',
      })),
    });
  } catch (e) {
    console.error('research-firecrawl error', e);
    return json({ error: 'internal_error', message: (e as Error).message }, 500);
  }
});
