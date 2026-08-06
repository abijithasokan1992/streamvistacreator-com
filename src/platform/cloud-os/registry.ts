export type StreamVistaSuiteId =
  | "media"
  | "business"
  | "automotive"
  | "commerce"
  | "finance"
  | "legal"
  | "education"
  | "cloud"
  | "ai"
  | "marketing"
  | "support"
  | "people"
  | "healthcare"
  | "real-estate";

export type StreamVistaApp = {
  id: string;
  name: string;
  description: string;
  suite: StreamVistaSuiteId;
  status: "live" | "beta" | "planned";
  commercial: boolean;
  capabilities: string[];
};

export const CLOUD_OS_ROUTE = "/settings/integrations/ai-assistants";
export const cloudOsAppUrl = (appId: string) => `${CLOUD_OS_ROUTE}?app=${encodeURIComponent(appId)}`;

export const STREAMVISTA_APPS: StreamVistaApp[] = [
  { id: "creator-cloud", name: "Creator Cloud", description: "Content ingest, metadata, QC and creator operations.", suite: "media", status: "live", commercial: true, capabilities: ["Title ingest", "Metadata", "QC workflow", "Creator workspace"] },
  { id: "buyer-marketplace", name: "Buyer Marketplace", description: "Rights-ready catalogue discovery and buyer workflows.", suite: "media", status: "live", commercial: true, capabilities: ["Catalogue search", "Buyer access", "Screeners", "Deal requests"] },
  { id: "delivery-control", name: "OTT Delivery Control", description: "Master delivery, QC status and release tracking.", suite: "media", status: "beta", commercial: true, capabilities: ["Delivery packages", "QC status", "Release tracking", "Partner requirements"] },
  { id: "rights-manager", name: "Rights Manager", description: "Territory, term, exclusivity and chain-of-title control.", suite: "legal", status: "beta", commercial: true, capabilities: ["Rights matrix", "Territories", "License windows", "Chain of title"] },
  { id: "contracts", name: "Contract Manager", description: "Agreement drafting, approval and lifecycle control.", suite: "legal", status: "beta", commercial: true, capabilities: ["Templates", "Approvals", "E-sign workflow", "Renewal alerts"] },
  { id: "crm", name: "CRM & Sales", description: "Leads, outreach, proposals, deals and follow-ups.", suite: "business", status: "beta", commercial: true, capabilities: ["Lead pipeline", "Outreach", "Proposals", "Deal stages"] },
  { id: "operations", name: "Operations Command", description: "Tasks, approvals, projects and company execution.", suite: "business", status: "beta", commercial: true, capabilities: ["Task control", "Approvals", "Project status", "Executive dashboard"] },
  { id: "union-stock", name: "Union Stock OS", description: "Inventory, purchase, billing and rack operations.", suite: "automotive", status: "beta", commercial: true, capabilities: ["Inventory", "Purchase bills", "Rack locations", "Billing"] },
  { id: "workshop", name: "Workshop Manager", description: "Vehicle jobs, technicians, estimates and service history.", suite: "automotive", status: "planned", commercial: true, capabilities: ["Job cards", "Technicians", "Estimates", "Service history"] },
  { id: "storefront", name: "Commerce Storefront", description: "Products, orders, sellers, fulfilment and customer portal.", suite: "commerce", status: "beta", commercial: true, capabilities: ["Products", "Cart", "Orders", "Seller portal"] },
  { id: "billing", name: "Billing & Subscription", description: "Plans, invoices, payments and account entitlements.", suite: "finance", status: "beta", commercial: true, capabilities: ["Plans", "Invoices", "Payments", "Entitlements"] },
  { id: "revenue", name: "Revenue Intelligence", description: "Revenue, payouts, reconciliation and forecasting.", suite: "finance", status: "planned", commercial: true, capabilities: ["Revenue reports", "Payouts", "Reconciliation", "Forecasts"] },
  { id: "learning-os", name: "Learning OS", description: "Courses, AI tutoring, assessments and certification.", suite: "education", status: "planned", commercial: true, capabilities: ["Courses", "AI tutor", "Assessments", "Certificates"] },
  { id: "cloud-control", name: "Cloud Control", description: "Vercel, Cloudflare, GitHub, database and deployment operations.", suite: "cloud", status: "beta", commercial: true, capabilities: ["Deployments", "Domains", "Repositories", "Health checks"] },
  { id: "ai-designer", name: "StreamVista AI Designer", description: "Generate and manage production UI systems without third-party builders.", suite: "ai", status: "beta", commercial: true, capabilities: ["UI generation", "Design systems", "Component registry", "Preview builds"] },
  { id: "agent-builder", name: "Agent Builder", description: "Create governed business agents and reusable MCP tools.", suite: "ai", status: "planned", commercial: true, capabilities: ["Agent templates", "Tool permissions", "MCP packaging", "Evaluations"] },
  { id: "workflow-builder", name: "Workflow Builder", description: "Connect tools, approvals, triggers and business processes.", suite: "ai", status: "planned", commercial: true, capabilities: ["Triggers", "Actions", "Approvals", "Audit trail"] },
  { id: "campaign-manager", name: "Campaign Manager", description: "Email, social, WhatsApp and promotional campaigns.", suite: "marketing", status: "planned", commercial: true, capabilities: ["Campaigns", "Audience lists", "Content calendar", "Performance"] },
  { id: "seo-analytics", name: "SEO & Growth", description: "Search visibility, traffic and conversion intelligence.", suite: "marketing", status: "planned", commercial: true, capabilities: ["SEO audit", "Traffic", "Conversion", "Growth reports"] },
  { id: "helpdesk", name: "Customer Support", description: "Tickets, SLA, knowledge base and customer communication.", suite: "support", status: "planned", commercial: true, capabilities: ["Tickets", "SLA", "Knowledge base", "Customer portal"] },
  { id: "people-os", name: "People & HR", description: "Employees, attendance, payroll and performance.", suite: "people", status: "planned", commercial: true, capabilities: ["Employee records", "Attendance", "Payroll", "Performance"] },
  { id: "clinic-os", name: "Clinic OS", description: "Appointments, patient records, billing and pharmacy workflows.", suite: "healthcare", status: "planned", commercial: true, capabilities: ["Appointments", "Patient records", "Billing", "Pharmacy"] },
  { id: "property-crm", name: "Property CRM", description: "Listings, leads, rentals and property operations.", suite: "real-estate", status: "planned", commercial: true, capabilities: ["Listings", "Buyer leads", "Rentals", "Broker portal"] }
];

export const STREAMVISTA_SUITES: Array<{ id: StreamVistaSuiteId; name: string; description: string }> = [
  { id: "media", name: "Media Suite", description: "Film, OTT, FAST, TV and creator operations." },
  { id: "business", name: "Business Suite", description: "CRM, sales, projects and company operations." },
  { id: "automotive", name: "Automotive Suite", description: "Spare-parts, workshop and inventory systems." },
  { id: "commerce", name: "Commerce Suite", description: "Storefront, marketplace and order workflows." },
  { id: "finance", name: "Finance Suite", description: "Billing, revenue, payout and reporting." },
  { id: "legal", name: "Legal Suite", description: "Rights, contracts, compliance and risk." },
  { id: "education", name: "Education Suite", description: "Learning, certification and institutional tools." },
  { id: "cloud", name: "Cloud Suite", description: "Infrastructure, deployments and integrations." },
  { id: "ai", name: "AI Suite", description: "AI Designer, agents, MCP tools and automation." },
  { id: "marketing", name: "Marketing Suite", description: "Campaigns, audience growth and conversion." },
  { id: "support", name: "Support Suite", description: "Helpdesk, SLA and customer success." },
  { id: "people", name: "People Suite", description: "HR, attendance, payroll and performance." },
  { id: "healthcare", name: "Healthcare Suite", description: "Clinic, patient and pharmacy workflows." },
  { id: "real-estate", name: "Real Estate Suite", description: "Property sales, rental and broker operations." }
];
