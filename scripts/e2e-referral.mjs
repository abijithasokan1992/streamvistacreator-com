#!/usr/bin/env node
/**
 * End-to-end referral flow test.
 *
 * Reproduces: referral code creation → incognito-style sign-up of a
 * second user → admin approval → reward verification.
 *
 * Required env:
 *   SUPABASE_URL              (defaults to VITE_SUPABASE_URL from .env)
 *   SUPABASE_ANON_KEY         (defaults to VITE_SUPABASE_PUBLISHABLE_KEY)
 *   E2E_ADMIN_EMAIL           existing admin account (for approval step)
 *   E2E_ADMIN_PASSWORD        admin password
 *
 * Optional:
 *   E2E_EMAIL_DOMAIN          domain for throwaway accounts (default: e2e.test)
 *   E2E_REWARD_TYPE           "storage" | "revenue" (default: storage)
 *   E2E_REWARD_AMOUNT         number (default: 100)
 *
 * Run:    node scripts/e2e-referral.mjs
 * Exits non-zero on any failed assertion.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvFile(".env");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const DOMAIN = process.env.E2E_EMAIL_DOMAIN || "e2e.test";
const REWARD_TYPE = process.env.E2E_REWARD_TYPE || "storage";
const REWARD_AMOUNT = Number(process.env.E2E_REWARD_AMOUNT || 100);

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("✗ Missing SUPABASE_URL or anon key");
  process.exit(2);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("✗ Missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD");
  process.exit(2);
}

const stamp = Date.now();
const PASSWORD = "E2E-" + Math.random().toString(36).slice(2) + "!Aa1";
const referrerEmail = `e2e-ref-${stamp}@${DOMAIN}`;
const refereeEmail = `e2e-new-${stamp}@${DOMAIN}`;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
// Three isolated clients = three "browsers"
const referrer = createClient(SUPABASE_URL, ANON_KEY, opts);
const referee = createClient(SUPABASE_URL, ANON_KEY, opts);
const admin = createClient(SUPABASE_URL, ANON_KEY, opts);

const log = (s) => console.log(s);
const fail = (msg, err) => {
  console.error("✗", msg, err?.message || err || "");
  process.exit(1);
};
const assert = (cond, msg) => { if (!cond) fail(msg); else log("✓ " + msg); };

async function signUp(client, email) {
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error) fail(`sign-up ${email}`, error);
  if (!data.session) {
    // Email confirmation enabled — fall back to sign-in attempt
    const { data: s, error: e2 } = await client.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (e2 || !s.session) fail(`session for ${email} (email confirmation may be on)`, e2);
    return s.user;
  }
  return data.user;
}

(async () => {
  log(`▶ E2E referral flow @ ${new Date().toISOString()}`);
  log(`  referrer=${referrerEmail}`);
  log(`  referee =${refereeEmail}`);

  // 1. Referrer signs up
  const referrerUser = await signUp(referrer, referrerEmail);
  assert(!!referrerUser?.id, "referrer signed up");

  // 2. Get / generate referral code (table auto-defaults code on insert)
  let code;
  {
    const sel = await referrer.from("referral_codes").select("code").maybeSingle();
    if (sel.data?.code) code = sel.data.code;
    else {
      const ins = await referrer
        .from("referral_codes")
        .insert({ user_id: referrerUser.id })
        .select("code")
        .single();
      if (ins.error) fail("create referral code", ins.error);
      code = ins.data.code;
    }
  }
  assert(!!code, `referral code obtained (${code})`);

  // 3. New incognito-style client: referee signs up
  const refereeUser = await signUp(referee, refereeEmail);
  assert(!!refereeUser?.id, "referee signed up");

  // 4. Referee calls attach_referral RPC (what ReferralCapture does)
  const attach = await referee.rpc("attach_referral", {
    _code: code,
    _email: refereeEmail,
  });
  if (attach.error) fail("attach_referral RPC", attach.error);
  assert(!!attach.data, "attach_referral returned referral id");
  const referralId = attach.data;

  // 5. Verify pending row visible to referrer
  {
    const { data, error } = await referrer
      .from("referrals")
      .select("id,status,referrer_code,referred_email")
      .eq("id", referralId)
      .maybeSingle();
    if (error) fail("read referral as referrer", error);
    assert(data?.status === "pending", "referral status = pending");
    assert(data?.referrer_code?.toUpperCase() === code.toUpperCase(), "referral linked to correct code");
  }

  // 6. Admin signs in & approves with reward
  {
    const { error } = await admin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error) fail("admin sign-in", error);
  }
  {
    const { error } = await admin
      .from("referrals")
      .update({
        status: "approved",
        reward_type: REWARD_TYPE,
        reward_amount: REWARD_AMOUNT,
        approved_at: new Date().toISOString(),
      })
      .eq("id", referralId);
    if (error) fail("admin approve referral (is account an admin?)", error);
    log("✓ admin approved referral");
  }

  // 7. Referrer sees approved reward in dashboard query
  {
    const { data, error } = await referrer
      .from("referrals")
      .select("status,reward_type,reward_amount")
      .eq("id", referralId)
      .maybeSingle();
    if (error) fail("re-read referral as referrer", error);
    assert(data?.status === "approved", "reward visible as approved");
    assert(data?.reward_type === REWARD_TYPE, `reward_type = ${REWARD_TYPE}`);
    assert(Number(data?.reward_amount) === REWARD_AMOUNT, `reward_amount = ${REWARD_AMOUNT}`);
  }

  // 8. Self-referral guard
  {
    const self = await referrer.rpc("attach_referral", {
      _code: code,
      _email: referrerEmail,
    });
    assert(!!self.error || self.data === null, "self-referral rejected");
  }

  log("\n✅ All referral-flow checks passed");
  process.exit(0);
})().catch((e) => fail("uncaught", e));
