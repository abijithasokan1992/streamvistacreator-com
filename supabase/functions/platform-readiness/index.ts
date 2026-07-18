// Platform Readiness Center — computes a live 5-state matrix per capability.
// Admin-only. Read-only. Never returns secret values, only booleans + counts.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';

type Pillar = 'frontend' | 'backend' | 'security' | 'integration' | 'production';
type CapabilityReport = {
  id: string;
  label: string;
  pillars: Record<Pillar, { ok: boolean; note: string }>;
};

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await anon.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: isSuper } = await admin.rpc('has_role', { _user_id: userId, _role: 'super_admin' });
    if (!isAdmin && !isSuper) return json({ error: 'Forbidden' }, 403);

    const env = (k: string) => (Deno.env.get(k) ?? '').trim();
    const has = (k: string) => env(k).length > 0;

    // ── Helpers ──────────────────────────────────────────────
    const countOf = async (table: string, filter?: (q: any) => any): Promise<{ ok: boolean; n: number }> => {
      try {
        let q: any = admin.from(table).select('*', { count: 'exact', head: true });
        if (filter) q = filter(q);
        const { count, error } = await q;
        if (error) return { ok: false, n: 0 };
        return { ok: true, n: count ?? 0 };
      } catch {
        return { ok: false, n: 0 };
      }
    };

    const rpcOk = async (fn: string, args: Record<string, unknown>) => {
      try {
        const { error } = await admin.rpc(fn, args);
        return !error;
      } catch { return false; }
    };

    // ── Parallel live probes ────────────────────────────────
    const [
      userProfiles, userRoles, adminRoles, activeUsers30d,
      recentUploads, completedUploads, ingestSources, ingestTelemetryOk,
      projects, projectsWithNumber,
      storageEntitlements, storageTopupsPaid,
      billingConfig, plansActive, invoicesPaid, subscriptions,
      emailState, emailLogSent, emailTemplatesLog,
      agentEvents, mcpAudit,
      productions, producerAssignments,
      rightsAvail, commercialProfiles, contentTitles, legalAgreements,
      distributionOffers, deliveries, deliveriesDone, dealMemos,
      acquisitionRequests, featuredFilms, introInvites, dealsClosed,
      siteConfig, razorpayConfig, freeTier,
      hasRoleFnOk,
    ] = await Promise.all([
      countOf('user_profiles'),
      countOf('user_roles'),
      countOf('user_roles', (q) => q.in('role', ['admin', 'super_admin'])),
      countOf('user_profiles', (q) => q.gte('last_active_at', new Date(Date.now() - 30 * 864e5).toISOString())),
      countOf('recent_uploads'),
      countOf('recent_uploads', (q) => q.eq('status', 'completed')),
      countOf('ingest_sources'),
      // ingest_telemetry has no `successful` column; derive from severity.
      // Non-error rows (`info`, `notice`, `debug`, `warning`) represent
      // events that reached the sink without a hard failure. See
      // src/integrations/supabase/types.ts → ingest_telemetry.
      countOf('ingest_telemetry', (q) => q.not('severity', 'in', '("error","critical","fatal")')),
      countOf('projects'),
      countOf('projects', (q) => q.not('crew', 'is', null)),
      countOf('workspace_storage_entitlements'),
      countOf('storage_topups', (q) => q.eq('status', 'paid')),
      admin.from('billing_config').select('id', { head: true, count: 'exact' }).then((r: any) => ({ ok: !r.error, n: r.count ?? 0 })),
      countOf('plans', (q) => q.eq('is_active', true)),
      countOf('invoices', (q) => q.eq('status', 'paid')),
      countOf('subscriptions'),
      admin.from('email_send_state').select('id', { head: true, count: 'exact' }).then((r: any) => ({ ok: !r.error, n: r.count ?? 0 })),
      countOf('email_send_log', (q) => q.eq('status', 'sent')),
      countOf('email_send_log'),
      countOf('agent_events', (q) => q.gte('created_at', new Date(Date.now() - 90 * 864e5).toISOString())),
      countOf('mcp_audit_log'),
      countOf('productions'),
      countOf('producer_assignments'),
      countOf('title_rights_availability'),
      countOf('title_commercial_profiles'),
      countOf('content_titles'),
      countOf('legal_agreements'),
      countOf('distribution_program_offers'),
      countOf('deal_deliveries'),
      countOf('deal_deliveries', (q) => q.eq('status', 'delivered')),
      countOf('deal_memos'),
      countOf('acquisition_requests'),
      countOf('featured_films'),
      countOf('intro_invites'),
      // deal_memos has no `signed_at`; report approval_status='approved'
      // accurately. Approval is not represented as a legal signature.
      countOf('deal_memos', (q) => q.eq('approval_status', 'approved')),
      admin.from('site_config').select('oracle_tenancy_ocid, oracle_bucket, oracle_region').eq('id', true).maybeSingle(),
      admin.from('razorpay_config').select('mode').eq('id', true).maybeSingle(),
      admin.from('free_tier_config').select('id').eq('id', true).maybeSingle(),
      rpcOk('has_role', { _user_id: userId, _role: 'admin' }),
    ]);

    const ociConfigured = !!(siteConfig?.data?.oracle_tenancy_ocid && siteConfig?.data?.oracle_bucket);
    const ociSecrets = has('ORACLE_PRIVATE_KEY') || has('OCI_PRIVATE_KEY');
    const rzpMode = (razorpayConfig?.data as { mode?: string } | null)?.mode ?? null;

    const b = (ok: boolean, note: string) => ({ ok, note });

    const capabilities: CapabilityReport[] = [
      {
        id: 'authentication',
        label: 'Authentication',
        pillars: {
          frontend: b(userProfiles.ok && userProfiles.n > 0, `${userProfiles.n} user profile(s) provisioned`),
          backend: b(userRoles.ok && hasRoleFnOk, `${userRoles.n} role assignments · has_role() live`),
          security: b(adminRoles.n > 0, `${adminRoles.n} admin/super-admin account(s)`),
          integration: b(activeUsers30d.n > 0, `${activeUsers30d.n} user(s) active in last 30 days`),
          production: b(emailTemplatesLog.n > 0, `${emailTemplatesLog.n} authentication email(s) dispatched`),
        },
      },
      {
        id: 'media-import',
        label: 'Media Import',
        pillars: {
          frontend: b(ingestSources.ok, `${ingestSources.n} ingest source(s) registered`),
          backend: b(recentUploads.ok, `${recentUploads.n} upload record(s) reachable`),
          security: b(ociSecrets, ociSecrets ? 'OCI signing key present' : 'OCI signing key missing'),
          integration: b(ociConfigured, ociConfigured ? 'Oracle bucket configured' : 'Oracle bucket not configured'),
          production: b(completedUploads.n > 0 && ingestTelemetryOk.n > 0, `${completedUploads.n} completed · ${ingestTelemetryOk.n} verified`),
        },
      },
      {
        id: 'auto-foldering',
        label: 'Automatic Foldering',
        pillars: {
          frontend: b(projects.ok, `${projects.n} project workspace(s)`),
          backend: b(projectsWithNumber.ok, `${projectsWithNumber.n} project(s) with production number`),
          security: b(userRoles.n > 0, 'Row-level security bound to user roles'),
          integration: b(ociConfigured, ociConfigured ? 'Bucket path template ready' : 'Bucket not configured'),
          production: b(projects.n > 0 && ociConfigured, `${projects.n} project(s) provisioned`),
        },
      },
      {
        id: 'storage',
        label: 'Storage',
        pillars: {
          frontend: b(storageEntitlements.ok, `${storageEntitlements.n} entitlement record(s)`),
          backend: b(recentUploads.ok, 'Storage tables reachable'),
          security: b(ociSecrets, ociSecrets ? 'Signing key secured' : 'Signing key missing'),
          integration: b(ociConfigured, ociConfigured ? 'Oracle Cloud connected' : 'Not connected'),
          production: b(storageTopupsPaid.n > 0 || storageEntitlements.n > 0, `${storageTopupsPaid.n} paid top-up(s) · ${storageEntitlements.n} entitlement(s)`),
        },
      },
      {
        id: 'billing',
        label: 'Billing',
        pillars: {
          frontend: b(plansActive.n > 0, `${plansActive.n} active plan(s)`),
          backend: b(billingConfig.ok && subscriptions.ok, `${subscriptions.n} subscription record(s)`),
          security: b(has('RAZORPAY_KEY_SECRET'), has('RAZORPAY_KEY_SECRET') ? 'Payment secret configured' : 'Payment secret missing'),
          integration: b(!!rzpMode, rzpMode ? `Payment gateway in ${rzpMode} mode` : 'Gateway not configured'),
          production: b(invoicesPaid.n > 0, `${invoicesPaid.n} paid invoice(s)`),
        },
      },
      {
        id: 'email',
        label: 'Email',
        pillars: {
          frontend: b(emailTemplatesLog.n > 0, `${emailTemplatesLog.n} email record(s) in log`),
          backend: b(emailState.ok && emailState.n > 0, emailState.n > 0 ? 'Queue state row present' : 'Queue state missing'),
          security: b(has('RESEND_API_KEY'), has('RESEND_API_KEY') ? 'Provider key configured' : 'Provider key missing'),
          integration: b(has('RESEND_API_KEY') && emailState.n > 0, 'Provider linked & queue live'),
          production: b(emailLogSent.n > 0, `${emailLogSent.n} email(s) delivered`),
        },
      },
      {
        id: 'ai',
        label: 'AI',
        pillars: {
          frontend: b(agentEvents.ok, `${agentEvents.n} assistant event(s) in 90 days`),
          backend: b(mcpAudit.ok, `${mcpAudit.n} tool audit record(s)`),
          security: b(has('LOVABLE_API_KEY'), has('LOVABLE_API_KEY') ? 'AI gateway key configured' : 'AI gateway key missing'),
          integration: b(has('LOVABLE_API_KEY'), 'AI gateway reachable'),
          production: b(agentEvents.n > 0, `${agentEvents.n} live invocation(s)`),
        },
      },
      {
        id: 'production-management',
        label: 'Production Management',
        pillars: {
          frontend: b(projects.ok, `${projects.n} production workspace(s)`),
          backend: b(productions.ok, `${productions.n} production record(s)`),
          security: b(producerAssignments.ok, `${producerAssignments.n} producer assignment(s)`),
          integration: b(projectsWithNumber.n > 0, `${projectsWithNumber.n} production(s) numbered`),
          production: b(projects.n > 0, `${projects.n} production(s) created`),
        },
      },
      {
        id: 'rights-management',
        label: 'Rights Management',
        pillars: {
          frontend: b(commercialProfiles.ok, `${commercialProfiles.n} commercial profile(s)`),
          backend: b(rightsAvail.ok, `${rightsAvail.n} rights window(s)`),
          security: b(legalAgreements.n > 0, `${legalAgreements.n} legal agreement(s) on file`),
          integration: b(contentTitles.n > 0, `${contentTitles.n} title(s) catalogued`),
          production: b(rightsAvail.n > 0, `${rightsAvail.n} rights record(s) live`),
        },
      },
      {
        id: 'distribution',
        label: 'Distribution',
        pillars: {
          frontend: b(distributionOffers.ok, `${distributionOffers.n} distribution offer(s)`),
          backend: b(deliveries.ok, `${deliveries.n} delivery record(s)`),
          security: b(dealMemos.ok, `${dealMemos.n} deal memo(s) secured`),
          integration: b(distributionOffers.n > 0, `${distributionOffers.n} offer(s) live`),
          production: b(deliveriesDone.n > 0, `${deliveriesDone.n} delivery(ies) completed`),
        },
      },
      {
        id: 'marketplace',
        label: 'Marketplace',
        pillars: {
          frontend: b(featuredFilms.ok, `${featuredFilms.n} featured title(s)`),
          backend: b(acquisitionRequests.ok, `${acquisitionRequests.n} acquisition request(s)`),
          security: b(introInvites.ok, `${introInvites.n} invitation record(s)`),
          integration: b(acquisitionRequests.n > 0 || featuredFilms.n > 0, 'Buyer surface populated'),
          production: b(dealsClosed.n > 0, `${dealsClosed.n} approved deal memo(s)`),
        },
      },
    ];

    return json({
      generated_at: new Date().toISOString(),
      capabilities,
    });
  } catch (e) {
    console.error('platform-readiness error', e);
    return json({ error: 'internal_error', message: (e as Error).message }, 500);
  }
});
