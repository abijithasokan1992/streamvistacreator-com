// Admin-only: issue a short-lived signed URL for a billing payment proof.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await user.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Confirm admin / super_admin via DB (don't trust client)
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: uid });
    if (!isAdmin && !isSuper) return json({ error: "Forbidden" }, 403);

    const { path, expiresIn } = await req.json();
    if (!path || typeof path !== "string") return json({ error: "path required" }, 400);

    const { data, error } = await admin.storage.from("billing-proofs").createSignedUrl(path, Math.min(Math.max(Number(expiresIn) || 300, 60), 1800));
    if (error) return json({ error: error.message }, 400);

    return json({ url: data.signedUrl, expires_in: Math.min(Math.max(Number(expiresIn) || 300, 60), 1800) });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
