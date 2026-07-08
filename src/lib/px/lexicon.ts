/**
 * StreamVista Product Language — single source of truth for UI copy.
 *
 * Non-negotiable: use these terms in every user-facing string.
 * Never introduce consumer/social terminology (Video, Feed, Channel,
 * Subscribers, Trending, Watch Later, Recommended).
 *
 * This file is UI-only. It never renames routes, database columns,
 * API fields, or business logic identifiers.
 */

export const LEXICON = {
  // ---------- Top-level surfaces ----------
  workspace: "Workspace",
  workspaces: "Workspaces",
  productions: "Productions",
  media: "Media",
  collections: "Collections",
  rights: "Rights",
  distribution: "Distribution",
  marketplace: "Marketplace",
  storage: "Storage",
  operations: "Operations",
  reports: "Reports",
  settings: "Settings",
  support: "Support",

  // ---------- Domain concepts ----------
  production: "Production",
  title: "Title",
  episode: "Episode",
  asset: "Asset",
  collection: "Collection",
  master: "Master",
  deliverable: "Deliverable",
  rawMedia: "RAW Media",
  proxyMedia: "Proxy Media",
  rightsPackage: "Rights Package",
  archive: "Archive",

  // ---------- Media Intelligence ----------
  mediaIntelligence: "Media Intelligence",
  businessInsights: "Business Insights",
  licensing: "Licensing",

  // ---------- Actions ----------
  createProduction: "Create Production",
  uploadMedia: "Upload Media",
  generateProxy: "Generate Proxy",
  saveMetadata: "Save Metadata",
  viewStorage: "View Storage",
  buyStorage: "Buy Storage",
  openLibrary: "Open Library",
  review: "Review",
  approve: "Approve",
  reject: "Reject",
  archiveAction: "Archive",
  distribute: "Distribute",
  license: "License",

  // ---------- Status ----------
  statusDraft: "Draft",
  statusInReview: "In Review",
  statusApproved: "Approved",
  statusRejected: "Rejected",
  statusPublished: "Published",
  statusArchived: "Archived",
  statusLocked: "Locked",
  statusProcessing: "Processing",
  statusReady: "Ready",
  statusFailed: "Failed",
} as const;

export type LexiconKey = keyof typeof LEXICON;

/** Convenience helper so we can grep `t("...")` for i18n later. */
export const t = (k: LexiconKey): string => LEXICON[k];
