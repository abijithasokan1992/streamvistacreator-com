import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listTitles from "./tools/list-titles";
import getTitle from "./tools/get-title";
import listIngestJobs from "./tools/list-ingest-jobs";

// Build the OAuth issuer from the Supabase project ref only (never SUPABASE_URL,
// which is the .lovable.cloud proxy on Cloud apps). Vite inlines this literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "streamvista-mcp",
  title: "StreamVista Cloud X",
  version: "0.1.0",
  instructions:
    "Read-only tools for a signed-in StreamVista Cloud X user. Use `whoami` to verify identity, `list_titles`/`get_title` for creator content, and `list_ingest_jobs` for Studio ingest progress. All data is scoped to the authenticated user via RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listTitles, getTitle, listIngestJobs],
});
