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
import creatorMyWorkspace from "./tools/creator-my-workspace";
import creatorListTitles from "./tools/creator-list-titles";
import creatorOpenTitle from "./tools/creator-open-title";
import creatorSubmissionStatus from "./tools/creator-submission-status";
import creatorRightsStatus from "./tools/creator-rights-status";
import creatorListAssets from "./tools/creator-list-assets";
import creatorReviewNotes from "./tools/creator-review-notes";
import creatorDistributionStatus from "./tools/creator-distribution-status";
import creatorStorageUsage from "./tools/creator-storage-usage";
import creatorNotifications from "./tools/creator-notifications";
import creatorSearchMyTitles from "./tools/creator-search-my-titles";
// Phase 1 MCP Control Server — founder / platform_owner / super_admin only.
// Every tool below authorizes + audits via `mcp_authorize_and_log` RPC and
// respects the production write kill switch (Phase 1 has zero writes).
import ctrlWhoami from "./tools/control/whoami-control";
import ctrlGetWorkspaceStatus from "./tools/control/get-workspace-status";
import ctrlGetTodayActivity from "./tools/control/get-today-activity";
import ctrlListCreators from "./tools/control/list-creators";
import ctrlListTitles from "./tools/control/ctrl-list-titles";
import ctrlListUploads from "./tools/control/list-uploads";
import ctrlListFailedUploads from "./tools/control/list-failed-uploads";
import ctrlListFailedUploadsAdmin from "./tools/control/ctrl-list-failed-uploads";
import ctrlListFailedEmails from "./tools/control/list-failed-emails";
import ctrlListPayments from "./tools/control/list-payments";
import ctrlListInvoices from "./tools/control/list-invoices";
import ctrlListBuyers from "./tools/control/list-buyers";
import ctrlGetStorageUsage from "./tools/control/get-storage-usage";
import ctrlGetDatabaseSchema from "./tools/control/get-database-schema";
import ctrlGetSecurityAdvisors from "./tools/control/get-security-advisors";
import ctrlGetEdgeFunctionLogs from "./tools/control/get-edge-function-logs";
import ctrlSearchWorkspaceRecords from "./tools/control/search-workspace-records";
import ctrlFindDuplicateTitles from "./tools/control/find-duplicate-titles";
import ctrlDeleteDraftTitles from "./tools/control/delete-draft-titles";
import ctrlImportLegacyTitles from "./tools/control/import-legacy-titles";

// This MCP installation is bound to the production Supabase OAuth issuer.
// Do not derive it from a generic Vite/Supabase environment variable: preview
// and clean-room environments can inject a different project id and silently
// break the ChatGPT account-connection handshake before any tool is invoked.
const projectRef = "hllgmkfqgeuqlmpcirvn";

export default defineMcp({
  name: "streamvista-mcp",
  title: "StreamVista Cloud X",
  version: "0.3.1",
  instructions:
    "Tools for a signed-in StreamVista Cloud X user. " +
    "Creator Workspace tools (Creator accounts only): `creator_my_workspace`, `creator_list_titles`, `creator_open_title`, `creator_submission_status`, `creator_rights_status`, `creator_list_assets`, `creator_review_notes`, `creator_distribution_status`, `creator_storage_usage`, `creator_notifications`, `creator_search_my_titles`. " +
    "Studio Workspace tools (Studio accounts only): `list_productions`, `open_production`, `show_todays_work`, `show_upload_progress`, `show_storage_usage`, `show_recent_activity`, `show_team`, `show_deliveries`, `show_billing`, `search_files`. " +
    "Legacy read tools kept for compatibility: `list_titles`, `get_title`, `list_ingest_jobs`. " +
    "Tools that are not available to the caller's role return a friendly access message instead of data. Use `whoami` to verify identity. All data is scoped to the signed-in user via RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    // Creator Workspace
    creatorMyWorkspace,
    creatorListTitles,
    creatorOpenTitle,
    creatorSubmissionStatus,
    creatorRightsStatus,
    creatorListAssets,
    creatorReviewNotes,
    creatorDistributionStatus,
    creatorStorageUsage,
    creatorNotifications,
    creatorSearchMyTitles,
    // Studio Workspace
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
    // Legacy read tools
    listTitles,
    getTitle,
    listIngestJobs,
    // Phase 1 Control Server — founder / platform_owner / super_admin only.
    ctrlWhoami,
    ctrlGetWorkspaceStatus,
    ctrlGetTodayActivity,
    ctrlListCreators,
    ctrlListTitles,
    ctrlListUploads,
    ctrlListFailedUploads,
    ctrlListFailedUploadsAdmin,
    ctrlListFailedEmails,
    ctrlListPayments,
    ctrlListInvoices,
    ctrlListBuyers,
    ctrlGetStorageUsage,
    ctrlGetDatabaseSchema,
    ctrlGetSecurityAdvisors,
    ctrlGetEdgeFunctionLogs,
    ctrlSearchWorkspaceRecords,
    // Cleanup + legacy import (write-guarded by kill switch)
    ctrlFindDuplicateTitles,
    ctrlDeleteDraftTitles,
    ctrlImportLegacyTitles,
  ],
});
