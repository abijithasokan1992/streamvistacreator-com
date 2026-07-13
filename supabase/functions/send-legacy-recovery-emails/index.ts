// Admin-only: for each unique email in legacy_film_imports without a
// recovery_email_sent_at, send exactly one personalized recovery invite via
// the shared transactional email pipeline, then mark all rows for that email
// as sent. Idempotent — safe to re-run; already-sent rows are skipped.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FilmRow {
  id: string
  legacy_film_id: number
  uploader_email: string
  payload: Record<string, any> | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'missing_auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller is admin/super_admin
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
  const roleSet = new Set((roles ?? []).map((r: any) => r.role))
  if (!roleSet.has('admin') && !roleSet.has('super_admin')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const dryRun: boolean = body?.dryRun === true

  // Pull all unsent legacy rows
  const { data: rows, error: fetchErr } = await admin
    .from('legacy_film_imports')
    .select('id, legacy_film_id, uploader_email, payload')
    .is('recovery_email_sent_at', null)
    .not('uploader_email', 'is', null)

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Group by lowercased email
  const groups = new Map<string, FilmRow[]>()
  for (const r of (rows ?? []) as FilmRow[]) {
    if (!r.uploader_email) continue
    const key = r.uploader_email.trim().toLowerCase()
    if (!key) continue
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }

  const loginUrl = 'https://streamvista.in/auth'
  const results: Array<{ email: string; count: number; ok: boolean; error?: string }> = []

  for (const [email, films] of groups) {
    const titles = films
      .map((f) => (f.payload?.title as string) || `Untitled #${f.legacy_film_id}`)
      .filter(Boolean)
    const producer = (films.find((f) => f.payload?.producer)?.payload?.producer as string) || ''
    const director = (films.find((f) => f.payload?.director)?.payload?.director as string) || ''
    const displayName = producer || director || email.split('@')[0]

    if (dryRun) {
      results.push({ email, count: films.length, ok: true })
      continue
    }

    try {
      const invokeRes = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'legacy-film-recovery',
          recipientEmail: email,
          idempotencyKey: `legacy-recovery-${email}`,
          templateData: {
            displayName,
            filmCount: films.length,
            loginUrl,
            filmTitles: titles,
          },
        },
      })

      if (invokeRes.error) throw new Error(invokeRes.error.message || 'send_failed')

      const ids = films.map((f) => f.id)
      const { error: updErr } = await admin
        .from('legacy_film_imports')
        .update({ recovery_email_sent_at: new Date().toISOString() })
        .in('id', ids)
      if (updErr) throw new Error(`mark_sent_failed: ${updErr.message}`)

      results.push({ email, count: films.length, ok: true })
    } catch (e: any) {
      results.push({ email, count: films.length, ok: false, error: String(e?.message ?? e) })
    }
  }

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return new Response(JSON.stringify({
    dryRun, uniqueEmails: groups.size, sent, failed, results,
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
