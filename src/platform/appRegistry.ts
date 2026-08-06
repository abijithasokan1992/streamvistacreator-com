export type StreamVistaSuiteId =
  | "media"
  | "business"
  | "automotive"
  | "commerce"
  | "finance"
  | "legal"
  | "education"
  | "cloud"
  | "ai";

export type StreamVistaApp = {
  id: string;
  name: string;
  description: string;
  suite: StreamVistaSuiteId;
  status: "live" | "beta" | "planned";
  route?: string;
  commercial: boolean;
};

export const STREAMVISTA_APPS: StreamVistaApp[] = [
  { id: "creator-cloud", name: "Creator Cloud", description: "Content ingest, metadata, QC and creator operations.", suite: "media", status: "live", route: "/creator", commercial: true },
  { id: "buyer-marketplace", name: "Buyer Marketplace", description: "Rights-ready catalogue discovery and buyer workflows.", suite: "media", status: "live", route: "/dashboard/buyer", commercial: true },
  { id: "rights-manager", name: "Rights Manager", description: "Territory, term, exclusivity and chain-of-title control.", suite: "legal", status: "beta", commercial: true },
  { id: "delivery-control", name: "OTT Delivery Control", description: "Master delivery, QC status and release tracking.", suite: "media", status: "beta", commercial: true },
  { id: "crm", name: "CRM & Sales", description: "Leads, outreach, proposals, deals and follow-ups.", suite: "business", status: "beta", commercial: true },
  { id: "union-stock", name: "Union Stock OS", description: "Inventory, purchase, billing and rack operations.", suite: "automotive", status: "beta", commercial: true },
  { id: "contracts", name: "Contract Manager", description: "Agreement drafting, approval and lifecycle control.", suite: "legal", status: "planned", commercial: true },
  { id: "billing", name: "Billing & Subscription", description: "Plans, invoices, payments and account entitlements.", suite: "finance", status: "planned", commercial: true },
  { id: "cloud-control", name: "Cloud Control", description: "Vercel, Cloudflare, GitHub, database and deployment operations.", suite: "cloud", status: "beta", commercial: true },
  { id: "ai-designer", name: "StreamVista AI Designer", description: "Generate and manage production UI systems without third-party builders.", suite: "ai", status: "planned", commercial: true },
  { id: "agent-builder", name: "Agent Builder", description: "Create governed business agents and reusable MCP tools.", suite: "ai", status: "planned", commercial: true },
  { id: "workflow-builder", name: "Workflow Builder", description: "Connect tools, approvals, triggers and business processes.", suite: "ai", status: "planned", commercial: true },
  { id: "storefront", name: "Commerce Storefront", description: "Products, orders, sellers, fulfilment and customer portal.", suite: "commerce", status: "planned", commercial: true },
  { id: "learning-os", name: "Learning OS", description: "Courses, AI tutoring, assessments and certification.", suite: "education", status: "planned", commercial: true }
];

export const STREAMVISTA_SUITES: Array<{ id: StreamVistaSuiteId; name: string; description: string }> = [
  { id: "media", name: "Media Suite", description: "Film, OTT, FAST, TV and creator operations." },
  { id: "business", name: "Business Suite", description: "CRM, sales, support and company operations." },
  { id: "automotive", name: "Automotive Suite", description: "Spare-parts, workshop and inventory systems." },
  { id: "commerce", name: "Commerce Suite", description: "Storefront, marketplace and order workflows." },
  { id: "finance", name: "Finance Suite", description: "Billing, revenue, payout and reporting." },
  { id: "legal", name: "Legal Suite", description: "Rights, contracts, compliance and risk." },
  { id: "education", name: "Education Suite", description: "Learning, certification and institutional tools." },
  { id: "cloud", name: "Cloud Suite", description: "Infrastructure, deployments and integrations." },
  { id: "ai", name: "AI Suite", description: "AI Designer, agents, MCP tools and automation." }
];
