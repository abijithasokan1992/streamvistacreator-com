// Receives a user-initiated "Report to admin" event from the SystemMessageBox.
// Creates a support_requests ticket (visible in admin Support Inbox) AND emails
// every admin via the send-transactional-email function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const {
      title = "System message",
      message = "",
      severity = "info",
      context = "",
      page = "",
    } = body ?? {};

    // 1. Create support ticket (service role bypasses RLS but we still own it)
    const subject = `[${String(severity).toUpperCase()}] ${String(title).slice(0, 180)}`;
    const fullMessage =
      `${message}\n\n` +
      (context ? `Context: ${context}\n` : "") +
      (page ? `Page: ${page}\n` : "") +
      `Reported from system message box.`;
    const { data: ticket, error: ticketErr } = await admin
      .from("support_requests")
      .insert({
        user_id: user.id,
        request_type: "other",
        subject,
        message: fullMessage,
        status: "open",
      })
      .select("id")
      .single();
    if (ticketErr) return json({ error: ticketErr.message }, 500);

    // 2. Look up admin emails
    const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (roles ?? []).map((r) => r.user_id);
    const adminEmails: string[] = [];
    for (const id of adminIds) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) adminEmails.push(data.user.email);
    }

    // 3. Fire emails (best-effort; ticket creation is the source of truth)
    const occurredAt = new Date().toISOString();
    const sendResults = await Promise.allSettled(
      adminEmails.map((to) =>
        admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "system-message-report",
            recipientEmail: to,
            idempotencyKey: `system-report-${ticket.id}-${to}`,
            templateData: {
              userEmail: user.email,
              userId: user.id,
              severity,
              title,
              message,
              context,
              page,
              occurredAt,
            },
          },
        }),
      ),
    );

    return json({
      ok: true,
      ticketId: ticket.id,
      notifiedAdmins: adminEmails.length,
      emailFailures: sendResults.filter((r) => r.status === "rejected").length,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
