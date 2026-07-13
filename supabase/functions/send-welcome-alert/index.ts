// Sends a Welcome (on signup) or Login alert (on sign-in) to the just-authenticated user.
// - Always tries to send a transactional email via send-transactional-email.
// - If Twilio credentials are configured, also fires WhatsApp (preferred) or SMS
//   when the user has a phone number on file. Otherwise the SMS/WhatsApp step is
//   skipped silently so a missing provider never blocks the auth flow.
//
// Intent detection: if the caller passes intent='auto' (default), we treat the
// session as a signup when the user's auth.users.created_at is within the last
// 5 minutes. This lets Google OAuth callers fire one call without knowing which
// it was.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildCorsHeaders, handleOptions } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_ORIGIN = Deno.env.get('SITE_ORIGIN') || 'https://streamvista.in'

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_WA_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || '' // e.g. "whatsapp:+14155238886"
const TWILIO_SMS_FROM = Deno.env.get('TWILIO_SMS_FROM') || ''     // e.g. "+15005550006"

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim().replace(/[^\d+]/g, '')
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return trimmed
  // Bare digits — assume already E.164 minus the plus.
  return trimmed.length >= 10 ? `+${trimmed}` : null
}

async function twilioSend(to: string, body: string, channel: 'whatsapp' | 'sms') {
  if (!TWILIO_SID || !TWILIO_TOKEN) return { skipped: 'twilio-not-configured' }
  const from = channel === 'whatsapp' ? TWILIO_WA_FROM : TWILIO_SMS_FROM
  if (!from) return { skipped: `${channel}-from-not-configured` }
  const dest = channel === 'whatsapp' ? `whatsapp:${to}` : to
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const form = new URLSearchParams({ To: dest, From: from, Body: body })
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const text = await res.text()
  if (!res.ok) return { error: `twilio ${res.status}: ${text.slice(0, 300)}` }
  try { return { sid: JSON.parse(text)?.sid ?? null } } catch { return { ok: true } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req)
  const cors = { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: cors })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  const { data: userRes } = await admin.auth.getUser(token)
  const authUser = userRes?.user
  if (!authUser) {
    return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: cors })
  }

  let body: { intent?: 'signup' | 'login' | 'auto'; method?: string } = {}
  try { body = await req.json() } catch { /* tolerate empty body */ }

  // Detect intent if caller didn't tell us.
  let intent: 'signup' | 'login' = body.intent === 'signup' || body.intent === 'login'
    ? body.intent
    : 'login'
  if (!body.intent || body.intent === 'auto') {
    const createdAt = authUser.created_at ? new Date(authUser.created_at).getTime() : 0
    intent = createdAt && (Date.now() - createdAt) < 5 * 60_000 ? 'signup' : 'login'
  }

  const method = (body.method || authUser.app_metadata?.provider || 'email').toString()
  const email = authUser.email
  if (!email) {
    return new Response(JSON.stringify({ error: 'user has no email on file' }), { status: 400, headers: cors })
  }

  // Pull display name + WhatsApp number from user_profiles.
  const { data: profile } = await admin
    .from('user_profiles')
    .select('display_name, first_name, whatsapp')
    .eq('user_id', authUser.id)
    .maybeSingle()

  const displayName =
    profile?.first_name ||
    profile?.display_name ||
    (authUser.user_metadata?.first_name as string | undefined) ||
    (authUser.user_metadata?.display_name as string | undefined) ||
    (email.split('@')[0] ?? 'there')

  const phone = normalisePhone(profile?.whatsapp || (authUser.user_metadata?.whatsapp as string | undefined))
  const ua = req.headers.get('user-agent') || undefined
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined

  const idempotencyKey = `welcome-${intent}-${authUser.id}-${new Date().toISOString().slice(0, 16)}`
  const templateName = intent === 'signup' ? 'welcome-account-created' : 'login-alert'
  const templateData = intent === 'signup'
    ? {
        displayName,
        dashboardUrl: `${SITE_ORIGIN}/vault`,
        signedUpAt: authUser.created_at,
        signupMethod: method,
      }
    : {
        displayName,
        loggedInAt: new Date().toISOString(),
        loginMethod: method,
        ipAddress: ip,
        userAgent: ua,
        resetUrl: `${SITE_ORIGIN}/auth`,
      }

  // Fire email (don't block on errors — log and continue).
  let emailResult: unknown = null
  try {
    const { data, error } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: email,
        idempotencyKey,
        templateData,
      },
    })
    emailResult = error ? { error: error.message } : data
  } catch (e) {
    emailResult = { error: (e as Error).message }
  }

  // Fire WhatsApp (preferred) then SMS as a fallback if WhatsApp is unconfigured.
  let waResult: unknown = null
  let smsResult: unknown = null
  if (phone) {
    const msg = intent === 'signup'
      ? `Welcome to StreamVista Cloud X, ${displayName}! Your workspace is ready: ${SITE_ORIGIN}/vault`
      : `New sign-in to your StreamVista account (${method}). If this wasn't you, reset your password: ${SITE_ORIGIN}/auth`
    if (TWILIO_WA_FROM) {
      waResult = await twilioSend(phone, msg, 'whatsapp')
    }
    if (TWILIO_SMS_FROM && (!waResult || (waResult as any).error || (waResult as any).skipped)) {
      smsResult = await twilioSend(phone, msg, 'sms')
    }
  }

  return new Response(JSON.stringify({
    intent,
    email: emailResult,
    whatsapp: waResult,
    sms: smsResult,
    phone_on_file: !!phone,
  }), { headers: cors })
})
