// Sends two emails after a creator successfully submits a title:
//   1. Creator confirmation — "Your submission was received and is under review."
//   2. Admin alert         — "A new title is awaiting review in the Action Inbox."
//
// Called from the frontend immediately after submit_title_to_admin succeeds.
// Uses service-role internally so it can look up admin emails and send to them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const DASHBOARD_URL =
  "https://streamvistacreator.com/dashboard/content-owner?section=titles";
const ADMIN_INBOX_URL =
  "https://streamvistacreator.com/dashboard/content-owner?section=admin";

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not authenticated" }, 401);

    // Admin client — used for all privileged lookups and internal function calls.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Validate the caller and confirm they are the title owner.
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const { titleId } = body ?? {};
    if (!titleId || typeof titleId !== "string") {
      return json({ error: "titleId is required" }, 400);
    }

    // Fetch the title — confirm it exists and belongs to the caller.
    const { data: titleRow, error: titleErr } = await admin
      .from("content_titles")
      .select("id, title, status, owner_user_id, submitted_at")
      .eq("id", titleId)
      .maybeSingle();

    if (titleErr || !titleRow) {
      return json({ error: "Title not found" }, 404);
    }
    if (titleRow.owner_user_id !== user.id) {
      return json({ error: "Forbidden" }, 403);
    }
    // Tolerate brief status lag — allow 'submitted' or still 'draft' while DB commits.
    if (!["submitted", "in_review", "draft", "incomplete"].includes(titleRow.status)) {
      return json({ error: "Title is not in a submittable state" }, 422);
    }

    const submittedAt = (titleRow.submitted_at as string | null) ?? new Date().toISOString();
    const titleName = titleRow.title as string;

    // ── 1. Creator confirmation email ─────────────────────────────────────────
    // We use the existing `title-status-update` template which already has the
    // correct copy for toStatus='submitted'.  The creator is the authenticated
    // caller so their email is guaranteed to match the JWT — allowed even for
    // non-service-role callers.  Here we invoke via the admin client (service
    // role) to simplify the single call path.
    const creatorEmailResult = await admin.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "title-status-update",
          recipientEmail: user.email,
          idempotencyKey: `title-submitted-creator-${titleId}`,
          templateData: {
            titleName,
            toStatus: "submitted",
            toStatusLabel: "Submission Received",
            fromStatus: null,
            note: "Your trailer and supporting materials have been received. Our review team will get back to you within 1–3 business days.",
            occurredAt: submittedAt,
            dashboardUrl: DASHBOARD_URL,
          },
        },
      },
    );
    if (creatorEmailResult.error) {
      console.warn("Creator confirmation email failed", creatorEmailResult.error);
    }

    // ── 2. Admin alert emails ─────────────────────────────────────────────────
    // Look up every user with the 'admin' role.
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    const adminEmails: string[] = [];
    for (const id of adminIds) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) adminEmails.push(data.user.email);
    }

    const adminEmailResults = await Promise.allSettled(
      adminEmails.map((to) =>
        admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "title-submission-admin-alert",
            recipientEmail: to,
            idempotencyKey: `title-submitted-admin-${titleId}-${to}`,
            templateData: {
              titleName,
              creatorEmail: user.email ?? "unknown",
              creatorId: user.id,
              submittedAt,
              inboxUrl: ADMIN_INBOX_URL,
            },
          },
        }),
      ),
    );

    const adminFailures = adminEmailResults.filter((r) => r.status === "rejected").length;
    if (adminFailures > 0) {
      console.warn(`${adminFailures} admin alert email(s) failed for title ${titleId}`);
    }

    return json({
      ok: true,
      creatorNotified: !creatorEmailResult.error,
      adminCount: adminEmails.length,
      adminFailures,
    });
  } catch (e) {
    console.error(
      "notify-title-submitted error",
      e instanceof Error ? e.message : String(e),
    );
    return json({ error: "Internal server error" }, 500);
  }
});
