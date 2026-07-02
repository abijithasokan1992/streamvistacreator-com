// evaluate-ingest-alerts
// ======================
// Cron-driven evaluator for Studio Ingest alert rules.
// Reads enabled rules, evaluates against the last `ingest_jobs` window,
// fires events that respect each rule's cooldown, and dispatches
// notifications via email (Lovable Emails) and WhatsApp (Twilio connector).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RuleType = 'connection_drop' | 'error_spike' | 'low_throughput'

interface Rule {
  id: string
  workspace_id: string
  name: string
  rule_type: RuleType
  enabled: boolean
  threshold: Record<string, number>
  channels: string[]
  recipients: {
    emails?: string[]
    phones?: string[]
    webhooks?: Array<{ url: string; secret?: string }>
  }
  cooldown_minutes: number
  last_fired_at: string | null
}

interface JobRow {
  id: string
  status: string
  total_bytes: number
  transferred_bytes: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface FireDecision {
  fire: boolean
  summary: string
  metrics: Array<{ label: string; value: string }>
  payload: Record<string, unknown>
}

function fmtBytes(n: number): string {
  if (!n || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

function evaluateRule(rule: Rule, jobs: JobRow[]): FireDecision {
  const now = Date.now()
  if (rule.rule_type === 'connection_drop') {
    const pausedMinutes = Math.max(1, Number(rule.threshold.paused_minutes ?? 10))
    const failedPct = Math.max(1, Number(rule.threshold.failed_pct ?? 100))
    const cutoff = now - pausedMinutes * 60_000
    const stuck = jobs.filter((j) =>
      (j.status === 'paused' || j.status === 'failed' || j.status === 'retrying') &&
      new Date(j.created_at).getTime() >= cutoff,
    )
    const recent = jobs.filter((j) => new Date(j.created_at).getTime() >= cutoff)
    const pct = recent.length > 0 ? Math.round((stuck.length / recent.length) * 100) : 0
    const fire = stuck.length > 0 && pct >= failedPct
    return {
      fire,
      summary: fire
        ? `${stuck.length} of ${recent.length} jobs are paused/failed in the last ${pausedMinutes} min (${pct}% ≥ threshold ${failedPct}%). Connection or source may be down.`
        : 'no drop',
      metrics: [
        { label: 'Window', value: `Last ${pausedMinutes} min` },
        { label: 'Affected jobs', value: String(stuck.length) },
        { label: 'Jobs in window', value: String(recent.length) },
        { label: 'Drop rate', value: `${pct}%` },
      ],
      payload: { pausedMinutes, failedPct, stuck: stuck.length, totalRecent: recent.length, pct },
    }
  }
  if (rule.rule_type === 'error_spike') {
    const windowMinutes = Math.max(5, Number(rule.threshold.window_minutes ?? 60))
    const failedPct = Math.max(1, Number(rule.threshold.failed_pct ?? 20))
    const minJobs = Math.max(1, Number(rule.threshold.min_jobs ?? 3))
    const cutoff = now - windowMinutes * 60_000
    const window = jobs.filter((j) => new Date(j.created_at).getTime() >= cutoff)
    const failed = window.filter((j) => j.status === 'failed').length
    const decided = window.filter((j) => j.status === 'failed' || j.status === 'completed').length
    const pct = decided > 0 ? Math.round((failed / decided) * 100) : 0
    const fire = window.length >= minJobs && pct >= failedPct
    return {
      fire,
      summary: fire
        ? `${pct}% failure rate over ${decided} completed/failed jobs in the last ${windowMinutes} min (threshold ${failedPct}%).`
        : 'no spike',
      metrics: [
        { label: 'Window', value: `Last ${windowMinutes} min` },
        { label: 'Jobs evaluated', value: String(window.length) },
        { label: 'Failed', value: String(failed) },
        { label: 'Failure rate', value: `${pct}%` },
      ],
      payload: { windowMinutes, failedPct, failed, total: window.length, pct },
    }
  }
  // low_throughput
  const windowMinutes = Math.max(5, Number(rule.threshold.window_minutes ?? 30))
  const minBps = Math.max(1, Number(rule.threshold.min_bytes_per_sec ?? 1_000_000))
  const minJobs = Math.max(1, Number(rule.threshold.min_jobs ?? 1))
  const cutoff = now - windowMinutes * 60_000
  const window = jobs.filter((j) =>
    j.completed_at && new Date(j.completed_at).getTime() >= cutoff && j.started_at,
  )
  let totalBytes = 0
  let totalSec = 0
  for (const j of window) {
    const ms = new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime()
    if (ms > 0) {
      totalBytes += j.transferred_bytes ?? 0
      totalSec += ms / 1000
    }
  }
  const avgBps = totalSec > 0 ? Math.round(totalBytes / totalSec) : 0
  const fire = window.length >= minJobs && totalSec > 0 && avgBps < minBps
  return {
    fire,
    summary: fire
      ? `Average throughput ${fmtBytes(avgBps)}/s across ${window.length} jobs in the last ${windowMinutes} min (below ${fmtBytes(minBps)}/s).`
      : 'throughput ok',
    metrics: [
      { label: 'Window', value: `Last ${windowMinutes} min` },
      { label: 'Jobs measured', value: String(window.length) },
      { label: 'Avg throughput', value: `${fmtBytes(avgBps)}/s` },
      { label: 'Floor', value: `${fmtBytes(minBps)}/s` },
    ],
    payload: { windowMinutes, minBps, avgBps, jobs: window.length },
  }
}

async function sendWhatsApp(phone: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
  const FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') // e.g. "whatsapp:+14155238886"
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM) {
    return { ok: false, error: 'twilio_not_configured' }
  }
  try {
    const res = await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
        From: FROM,
        Body: body,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `twilio_${res.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

async function sendWebhook(
  endpoint: { url: string; secret?: string },
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!/^https:\/\//i.test(endpoint.url)) {
    return { ok: false, error: 'webhook_url_must_be_https' }
  }
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'StreamVista-Ingest-Alerts/1.0',
    'X-StreamVista-Event': 'ingest.alert',
    'X-StreamVista-Delivery': crypto.randomUUID(),
  }
  if (endpoint.secret) {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(endpoint.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0')).join('')
      headers['X-StreamVista-Signature'] = `sha256=${hex}`
    } catch (e) {
      return { ok: false, error: `sign_failed: ${(e as Error).message}` }
    }
  }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(endpoint.url, { method: 'POST', headers, body, signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text.slice(0, 200) || `http_${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // Optional single-rule trigger from UI ("Test alert now")
  let singleRuleId: string | null = null
  let forceFire = false
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      singleRuleId = body?.ruleId ?? null
      forceFire = body?.test === true
    } catch { /* cron call, no body */ }
  }

  const rulesQ = admin
    .from('ingest_alert_rules')
    .select('id,workspace_id,name,rule_type,enabled,threshold,channels,recipients,cooldown_minutes,last_fired_at')
    .eq('enabled', true)
  if (singleRuleId) rulesQ.eq('id', singleRuleId)

  const { data: rules, error: rulesErr } = await rulesQ
  if (rulesErr) {
    return new Response(JSON.stringify({ error: rulesErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const summary: Array<Record<string, unknown>> = []

  for (const rule of (rules ?? []) as Rule[]) {
    // Cooldown gate (skip if test mode)
    if (!forceFire && rule.last_fired_at) {
      const since = Date.now() - new Date(rule.last_fired_at).getTime()
      if (since < rule.cooldown_minutes * 60_000) {
        summary.push({ ruleId: rule.id, skipped: 'cooldown' })
        await admin.from('ingest_alert_rules')
          .update({ last_evaluated_at: new Date().toISOString() })
          .eq('id', rule.id)
        continue
      }
    }

    // Pull the last 2h of jobs for this workspace — large enough for any rule window.
    const since = new Date(Date.now() - 2 * 3600_000).toISOString()
    const { data: jobs } = await admin
      .from('ingest_jobs')
      .select('id,status,total_bytes,transferred_bytes,started_at,completed_at,created_at')
      .eq('workspace_id', rule.workspace_id)
      .gte('created_at', since)
      .limit(500)

    const decision = forceFire
      ? {
          fire: true,
          summary: `Test alert for rule "${rule.name}".`,
          metrics: [{ label: 'Mode', value: 'Test fire' }],
          payload: { test: true },
        }
      : evaluateRule(rule, (jobs ?? []) as JobRow[])

    await admin.from('ingest_alert_rules')
      .update({ last_evaluated_at: new Date().toISOString() })
      .eq('id', rule.id)

    if (!decision.fire) {
      summary.push({ ruleId: rule.id, fired: false })
      continue
    }

    // Resolve workspace label
    const { data: ws } = await admin
      .from('workspaces').select('name').eq('id', rule.workspace_id).maybeSingle()
    const workspaceName = (ws as any)?.name ?? 'Workspace'

    const channelsAttempted: string[] = []
    const deliveryStatus: Record<string, unknown> = {}

    // Email channel
    if (rule.channels.includes('email')) {
      channelsAttempted.push('email')
      const emails = (rule.recipients?.emails ?? []).filter((e) => typeof e === 'string' && e.includes('@'))
      const sent: string[] = []
      const failed: Array<{ email: string; error: string }> = []
      for (const email of emails) {
        try {
          const { error } = await admin.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'ingest-alert',
              recipientEmail: email,
              idempotencyKey: `ingest-alert-${rule.id}-${Date.now()}`,
              templateData: {
                workspaceName,
                ruleName: rule.name,
                ruleType: rule.rule_type,
                summary: decision.summary,
                metrics: decision.metrics,
                firedAt: new Date().toISOString(),
                dashboardUrl: 'https://streamvistacreator.com/dashboard/studio',
              },
            },
          })
          if (error) failed.push({ email, error: error.message })
          else sent.push(email)
        } catch (e) {
          failed.push({ email, error: (e as Error).message })
        }
      }
      deliveryStatus.email = { sent, failed }
    }

    // WhatsApp channel
    if (rule.channels.includes('whatsapp')) {
      channelsAttempted.push('whatsapp')
      const phones = (rule.recipients?.phones ?? []).filter((p) => typeof p === 'string' && p.length >= 6)
      const sent: string[] = []
      const failed: Array<{ phone: string; error: string }> = []
      const body = `[Studio Ingest] ${rule.name}\n${decision.summary}\nOpen: https://streamvistacreator.com/dashboard/studio`
      for (const phone of phones) {
        const r = await sendWhatsApp(phone, body)
        if (r.ok) sent.push(phone)
        else failed.push({ phone, error: r.error ?? 'unknown' })
      }
      deliveryStatus.whatsapp = { sent, failed }
    }

    // Webhook channel — POST signed JSON to internal systems
    if (rule.channels.includes('webhook')) {
      channelsAttempted.push('webhook')
      const endpoints = (rule.recipients?.webhooks ?? []).filter(
        (w) => w && typeof w.url === 'string' && /^https:\/\//i.test(w.url),
      )
      const sent: Array<{ url: string; status?: number }> = []
      const failed: Array<{ url: string; error: string; status?: number }> = []
      const firedAt = new Date().toISOString()
      const webhookPayload = {
        event: 'ingest.alert',
        firedAt,
        test: forceFire,
        workspace: { id: rule.workspace_id, name: workspaceName },
        rule: {
          id: rule.id,
          name: rule.name,
          type: rule.rule_type,
          threshold: rule.threshold,
        },
        summary: decision.summary,
        metrics: decision.metrics,
        details: decision.payload,
        dashboardUrl: 'https://streamvistacreator.com/dashboard/studio',
      }
      for (const ep of endpoints) {
        const r = await sendWebhook(ep, webhookPayload)
        if (r.ok) sent.push({ url: ep.url, status: r.status })
        else failed.push({ url: ep.url, error: r.error ?? 'unknown', status: r.status })
      }
      deliveryStatus.webhook = { sent, failed }
    }



    await admin.from('ingest_alert_events').insert({
      rule_id: rule.id,
      workspace_id: rule.workspace_id,
      rule_type: rule.rule_type,
      payload: { summary: decision.summary, metrics: decision.metrics, ...decision.payload },
      channels_attempted: channelsAttempted,
      delivery_status: deliveryStatus,
    })

    await admin.from('ingest_alert_rules')
      .update({ last_fired_at: new Date().toISOString() })
      .eq('id', rule.id)

    summary.push({ ruleId: rule.id, fired: true, channels: channelsAttempted, deliveryStatus })
  }

  return new Response(JSON.stringify({ ok: true, evaluated: rules?.length ?? 0, summary }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
