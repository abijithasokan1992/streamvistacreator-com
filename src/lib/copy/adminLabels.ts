/**
 * Plain-language label registry for the Admin, Finance and Payments surfaces.
 *
 * Purpose: one place to change user-visible wording. Nothing here changes
 * business logic, database columns, RPC names, edge function names, RLS,
 * or payment processing. Route paths and internal identifiers stay as-is.
 *
 * If you need a new label, add it here and import it — do not hardcode a
 * new plain-English string in a component.
 */

// ---------------------------------------------------------------------------
// Section 1 — Action, panel and column labels
// ---------------------------------------------------------------------------

export const ADMIN_LABELS = {
  // Global admin actions
  runSystemCheck: "Run System Check",
  reviewAndApproveContent: "Review & Approve Content",
  releaseContent: "Release Content",
  contentQualityReview: "Content Quality Review",
  rightsAndLegalReview: "Rights & Legal Review",
  sendPartnerPayments: "Send Partner Payments",
  retryFailedUploads: "Retry Failed Uploads",
  processUploadAgain: "Process upload again",
  activityHistory: "Activity History",
  manualAdminApproval: "Manual Admin Approval",

  // Panel descriptions
  reviewTechnicalQuality: "Review technical quality",
  reviewRightsAndLegal: "Review rights and legal documents",

  // Marketplace / buyer
  contentMarketplace: "Content Marketplace",
  pricingCalculator: "Pricing Calculator",
  purchasedContent: "Purchased Content",

  // Intelligence
  marketInsights: "Market Insights",
  businessReports: "Business Reports",

  // Finance top-level
  paymentsAndFinance: "Payments & Finance",
  billingAndPayments: "Billing & Payments",
  paymentHistory: "Payment History",
  addRevenueData: "Add Revenue Data",
  partnerEarningsReports: "Partner Earnings Reports",
  revenueShareCalculator: "Revenue Share Calculator",
  completedPayments: "Completed Payments",
  paymentsAwaitingReview: "Payments Awaiting Review",
  customQuotesAndInvoices: "Custom Quotes & Invoices",
  checkOverdueInvoices: "Check Overdue Invoices",
  paymentJourney: "Payment Journey",
  detailedPaymentHistory: "Detailed Payment History",
  paymentSettings: "Payment Settings",

  // Payment lifecycle terms (used inline in prose)
  paymentReturnCheck: "Payment Return Check",
  confirmPayment: "Confirm Payment",
  automaticPaymentUpdate: "Automatic Payment Update",
  accessGranted: "Access Granted",
  testPaymentCheck: "Test Payment Check",

  // Revenue metrics
  totalRevenue: "Total Revenue",
  revenueAfterDeductions: "Revenue After Deductions",
  paymentsDue: "Payments Due",
  availableToFinanceTeam: "Available to Finance Team",

  // Column headers / row labels
  colDateSubmitted: "Date Submitted",
  colBankReferenceNumber: "Bank Reference Number",
  colCustomer: "Customer",
  colAmount: "Amount",
  colDate: "Date",
  colPaymentStatus: "Payment Status",
  colRecommendedAction: "Recommended Action",

  // Status flags on records / routes
  noLongerUsed: "No Longer Used",
  testOnly: "Test Only",

  // Disclosure
  viewTechnicalDetails: "View Technical Details",
  hideTechnicalDetails: "Hide Technical Details",
  testRecord: "Test record",
} as const;

// ---------------------------------------------------------------------------
// Section 2 — Website / origin role labels
// ---------------------------------------------------------------------------

export const SITE_ROLE_LABELS = {
  officialAppAndPayment: "Official App & Payment Website",
  mainRegisteredWebsite: "Main Registered Website",
  registeredWithRazorpay: "Website Registered with Razorpay",
  testWebsite: "Test Website",
  currentlyOpen: "Website Currently Open",
} as const;

// ---------------------------------------------------------------------------
// Section 3 — Razorpay website-approval banner copy (verbatim)
// ---------------------------------------------------------------------------

export const RAZORPAY_BANNER_COPY = {
  heading: "Razorpay Website Approval Pending",
  intro:
    "Razorpay is reviewing our request to change the main registered website to:",
  approvedDomain: "https://streamvista.in",
  stillShowsIntro:
    "Until Razorpay approves the change, its dashboard may continue showing:",
  stillShowsDomain: "https://www.crayonsloop.com",
  reassurance:
    "This does not affect the StreamVista application setup. StreamVista uses https://streamvista.in for payments, payment confirmation, invoices, and customer access.",
  currentWebsitesHeading: "Current websites",
  appPaymentLabel: "StreamVista App and Payment Website",
  appPaymentDomain: "https://streamvista.in",
  companyLabel: "Company Website",
  companyDomain: "https://www.crayonspictures.com",
  razorpayShownLabel: "Website Currently Shown in Razorpay",
  razorpayShownDomain: "https://www.crayonsloop.com",
  razorpayShownNote: "This website is no longer used by StreamVista.",
  previewLabel: "Test Preview Website",
  previewDomain: "https://streamvista-creator.lovable.app",
  previewNote: "Used only for testing. Do not use it for real payments.",
  statusHeading: "Current Status",
  statusLine1: "Development and testing can continue safely.",
  statusLine2:
    "After Razorpay approves the website change, complete one real Studio Vault purchase through https://streamvista.in to confirm that live payments are working correctly.",
} as const;

// ---------------------------------------------------------------------------
// Section 4 — Payment status wording
// ---------------------------------------------------------------------------

export type PaymentStatusTone = "success" | "warning" | "error" | "info" | "muted";

export interface PaymentStatusDescriptor {
  /** Plain-language label shown next to the amount. */
  label: string;
  /** Visual tone hint for badges / dots. */
  tone: PaymentStatusTone;
  /** One-sentence customer-facing description. */
  hint: string;
}

const STATUS_MAP: Record<string, PaymentStatusDescriptor> = {
  // Success
  captured: {
    label: "Payment Successful",
    tone: "success",
    hint: "The payment was completed and confirmed.",
  },
  paid: {
    label: "Payment Successful",
    tone: "success",
    hint: "The payment was completed and confirmed.",
  },
  success: {
    label: "Payment Successful",
    tone: "success",
    hint: "The payment was completed and confirmed.",
  },
  active: {
    label: "Payment Successful",
    tone: "success",
    hint: "The payment was completed and confirmed.",
  },
  authenticated: {
    label: "Payment Successful",
    tone: "success",
    hint: "The payment was completed and confirmed.",
  },

  // Started / in-progress
  created: {
    label: "Payment Started",
    tone: "info",
    hint: "The customer opened the payment window, but payment has not yet been completed.",
  },
  attempted: {
    label: "Payment Started",
    tone: "info",
    hint: "The customer opened the payment window, but payment has not yet been completed.",
  },
  pending: {
    label: "Payment Confirmation Pending",
    tone: "warning",
    hint: "Razorpay received the payment update, but StreamVista has not completed its final confirmation.",
  },
  verify_delayed: {
    label: "Payment Confirmation Pending",
    tone: "warning",
    hint: "Razorpay received the payment update, but StreamVista has not completed its final confirmation.",
  },

  // Failure
  failed: {
    label: "Payment Failed",
    tone: "error",
    hint: "The payment could not be completed.",
  },
  halted: {
    label: "Payment Failed",
    tone: "error",
    hint: "The payment could not be completed.",
  },
  cancelled: {
    label: "Payment Window Closed",
    tone: "muted",
    hint: "The customer closed the payment window before completing payment.",
  },
  dismissed: {
    label: "Payment Window Closed",
    tone: "muted",
    hint: "The customer closed the payment window before completing payment.",
  },

  // Refunds
  refund_started: {
    label: "Refund Started",
    tone: "info",
    hint: "A refund request was created.",
  },
  refunded: {
    label: "Refund Completed",
    tone: "success",
    hint: "The refunded amount was returned successfully.",
  },
  refund_processed: {
    label: "Refund Completed",
    tone: "success",
    hint: "The refunded amount was returned successfully.",
  },

  // Domain / configuration
  website_not_approved: {
    label: "Website Not Approved for Payment",
    tone: "error",
    hint: "The payment was blocked because the website used for payment did not match the website registered with Razorpay.",
  },
};

/**
 * Map any raw payment status coming from Razorpay / internal tables into a
 * plain-language descriptor. Unknown values fall back to a neutral display
 * so we never surface raw internal keys to non-technical users.
 */
export function paymentStatusLabel(status: string | null | undefined): PaymentStatusDescriptor {
  if (!status) {
    return {
      label: "Payment Confirmation Pending",
      tone: "muted",
      hint: "No payment status has been recorded yet.",
    };
  }
  const key = String(status).trim().toLowerCase();
  return (
    STATUS_MAP[key] ?? {
      label: "Payment Confirmation Pending",
      tone: "muted",
      hint: "Razorpay received the payment update, but StreamVista has not completed its final confirmation.",
    }
  );
}

/**
 * Map a raw Razorpay event name (payment.captured, refund.processed, …) into
 * a plain-language "what happened" line. The raw event stays visible only
 * inside the technical-details disclosure.
 */
export function razorpayEventLabel(event: string | null | undefined): string {
  if (!event) return "Payment update";
  const key = String(event).trim().toLowerCase();
  switch (key) {
    case "payment.captured":
    case "order.paid":
      return "Payment Successful";
    case "payment.failed":
      return "Payment Failed";
    case "payment.authorized":
      return "Payment Started";
    case "refund.processed":
    case "refund.created":
      return "Refund Completed";
    case "subscription.activated":
      return "Subscription started";
    case "subscription.charged":
      return "Subscription payment received";
    case "subscription.halted":
    case "subscription.cancelled":
      return "Subscription stopped";
    case "subscription.completed":
      return "Subscription completed";
    case "admin.test":
      return "Test record";
    case "verify.payment":
      return "Confirm Payment";
    default:
      return "Payment update";
  }
}

/**
 * Whether a row represents a synthetic / internal test record that should
 * be collapsed behind the technical-details disclosure by default.
 */
export function isTestRecord(event: string | null | undefined, source?: string | null): boolean {
  const e = (event ?? "").toLowerCase();
  const s = (source ?? "").toLowerCase();
  return e === "admin.test" || s.includes("synthetic") || s.includes("admin.test");
}
