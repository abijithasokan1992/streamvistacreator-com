/**
 * Central label registry for the Media Office admin surface.
 * Copy-only — no route or table renames. Change these strings to change
 * the wording everywhere in one place.
 */
export const OFFICE = {
  // Rooms
  dashboard: "Dashboard",
  movieDesk: "Movie Desk",
  buyerMapping: "Buyer Mapping",
  accounts: "Accounts",

  // Sub-panels
  movieVault: "Movie Vault",
  qualityCheck: "Quality Check",
  legalAgreements: "Legal & Agreements",
  officeHealth: "Office Health",
  priorityInbox: "Today's Priority",

  buyers: "Buyers",
  offers: "Offers",
  activeMappings: "Buyers currently mapped",

  invoices: "Invoices",
  royalty: "Royalty",
  statements: "Revenue Statements",

  // Counter labels (plain film-office language)
  countAwaitingQc: "Movies waiting for Quality Check",
  countAwaitingLegal: "Movies waiting for Legal & Agreements",
  countDrafts: "Unfinished submissions",
  countSubmitted: "Newly submitted",
  countApproved: "Approved, not published",
  countPublished: "Published movies",
  countActiveMappings: "Buyers currently mapped",
  countOpenOffers: "Open offers",

  // Actions
  approve: "Approve",
  sendBack: "Send Back",
  markReady: "Mark Ready",
} as const;
