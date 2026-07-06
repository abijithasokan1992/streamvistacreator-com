import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listTitles from "./tools/list-titles";
import getTitle from "./tools/get-title";
import listIngestJobs from "./tools/list-ingest-jobs";
import listProductions from "./tools/list-productions";
import openProduction from "./tools/open-production";
import showTodaysWork from "./tools/show-todays-work";
import showUploadProgress from "./tools/show-upload-progress";
import showStorageUsage from "./tools/show-storage-usage";
import showRecentActivity from "./tools/show-recent-activity";
import showTeam from "./tools/show-team";
import showDeliveries from "./tools/show-deliveries";
import showBilling from "./tools/show-billing";
import searchFiles from "./tools/search-files";

// Build the OAuth issuer from the Supabase project ref only (never SUPABASE_URL,
// which is the .lovable.cloud proxy on Cloud apps). Vite inlines this literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "streamvista-mcp",
  title: "StreamVista Cloud X",
  version: "0.2.0",
  instructions:
    "Tools for a signed-in StreamVista Cloud X user. Creator tools: `list_titles`, `get_title`. Studio Workspace tools: `list_productions`, `open_production`, `show_todays_work`, `show_upload_progress`, `show_storage_usage`, `show_recent_activity`, `show_team`, `show_deliveries`, `show_billing`, `search_files`. Studio tools return a friendly access message when called by non-Studio users. Use `whoami` to verify identity. All data is scoped to the signed-in user via RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    listTitles,
    getTitle,
    listIngestJobs,
    listProductions,
    openProduction,
    showTodaysWork,
    showUploadProgress,
    showStorageUsage,
    showRecentActivity,
    showTeam,
    showDeliveries,
    showBilling,
    searchFiles,
  ],
});
