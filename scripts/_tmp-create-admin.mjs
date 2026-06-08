import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const c = createClient(url, key, { auth: { persistSession:false }});
const email = process.argv[2], password = process.argv[3];
const { data, error } = await c.auth.signUp({ email, password });
if (error && !/already/i.test(error.message)) { console.error(error.message); process.exit(1); }
let uid = data?.user?.id;
if (!uid) {
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) { console.error(s.error.message); process.exit(1); }
  uid = s.data.user.id;
}
console.log(uid);
