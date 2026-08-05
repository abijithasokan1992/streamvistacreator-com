export type IntegrationPhase = "validate" | "improve" | "automate" | "grow";
export type IntegrationStatus = "configured" | "partial" | "missing" | "not_required";

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: string;
  phase: IntegrationPhase;
  requiredEnv: string[];
  serverOnly?: boolean;
  notes: string;
}

export const integrationRegistry: IntegrationDefinition[] = [
  { id: "supabase", name: "Supabase", category: "Backend", phase: "validate", requiredEnv: ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"], notes: "Auth, PostgreSQL, Storage, Realtime, RLS and Edge Functions." },
  { id: "oracle-object-storage", name: "Oracle Object Storage", category: "Storage", phase: "validate", requiredEnv: ["OCI_TENANCY_OCID", "OCI_USER_OCID", "OCI_FINGERPRINT", "OCI_REGION", "OCI_NAMESPACE", "OCI_BUCKET", "OCI_PRIVATE_KEY"], serverOnly: true, notes: "Primary large-file storage for masters, DCP, ProRes, artwork and delivery assets. Credentials must remain server-side; browser uploads use signed multipart requests." },
  { id: "oracle-autonomous-db", name: "Oracle Autonomous Database", category: "Database", phase: "improve", requiredEnv: ["ORACLE_ORDS_BASE_URL", "ORACLE_ORDS_BEARER_TOKEN"], serverOnly: true, notes: "Optional free-tier database accessed only through secured ORDS/API. Do not connect browser clients directly. Supabase remains the active auth and operational database until migration tests pass." },
  { id: "razorpay", name: "Razorpay", category: "Payments", phase: "validate", requiredEnv: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], serverOnly: true, notes: "Orders, webhooks, billing, GST and payout records." },
  { id: "openai", name: "OpenAI", category: "AI", phase: "automate", requiredEnv: ["OPENAI_API_KEY"], serverOnly: true, notes: "Metadata, assistance and controlled agent workflows." },
  { id: "anthropic", name: "Claude", category: "AI", phase: "automate", requiredEnv: ["ANTHROPIC_API_KEY"], serverOnly: true, notes: "Optional fallback/review model; do not call from browser." },
  { id: "gemini", name: "Gemini", category: "AI", phase: "automate", requiredEnv: ["GEMINI_API_KEY"], serverOnly: true, notes: "Optional multimodal processing and metadata support." },
  { id: "perplexity", name: "Perplexity", category: "AI", phase: "grow", requiredEnv: ["PERPLEXITY_API_KEY"], serverOnly: true, notes: "External research only; never a source of legal truth." },
  { id: "ga4", name: "Google Analytics 4", category: "Analytics", phase: "grow", requiredEnv: ["VITE_GA4_MEASUREMENT_ID"], notes: "Web acquisition and conversion measurement." },
  { id: "clarity", name: "Microsoft Clarity", category: "Analytics", phase: "improve", requiredEnv: ["VITE_CLARITY_PROJECT_ID"], notes: "Session diagnostics with privacy controls." },
  { id: "mixpanel", name: "Mixpanel", category: "Analytics", phase: "grow", requiredEnv: ["VITE_MIXPANEL_TOKEN"], notes: "Product event analytics after event taxonomy approval." },
  { id: "firebase", name: "Firebase", category: "Monitoring", phase: "improve", requiredEnv: ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"], notes: "Web analytics/performance; Crashlytics and Test Lab only for native builds." },
  { id: "onesignal", name: "OneSignal", category: "Communication", phase: "automate", requiredEnv: ["VITE_ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"], notes: "Push notifications; REST key must remain server-side." },
  { id: "brevo", name: "Brevo", category: "Communication", phase: "automate", requiredEnv: ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"], serverOnly: true, notes: "Transactional email and approved campaigns." },
  { id: "hubspot", name: "HubSpot", category: "CRM", phase: "grow", requiredEnv: ["HUBSPOT_ACCESS_TOKEN"], serverOnly: true, notes: "Creators, buyers, companies and licensing deal pipeline." },
  { id: "n8n", name: "n8n", category: "Automation", phase: "automate", requiredEnv: ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_SECRET"], serverOnly: true, notes: "Signed workflow triggers only; no unrestricted public webhooks." },
  { id: "cloudflare", name: "Cloudflare", category: "Infrastructure", phase: "validate", requiredEnv: ["CLOUDFLARE_ZONE_ID"], serverOnly: true, notes: "DNS, CDN, TLS and WAF validation." },
  { id: "vercel", name: "Vercel", category: "Infrastructure", phase: "validate", requiredEnv: ["VERCEL_PROJECT_ID"], serverOnly: true, notes: "Production deployment and environment management." }
];

export function getClientIntegrationStatus(definition: IntegrationDefinition): IntegrationStatus {
  if (definition.serverOnly) return "partial";
  const env = import.meta.env as Record<string, string | undefined>;
  return definition.requiredEnv.every((key) => Boolean(env[key])) ? "configured" : "missing";
}
