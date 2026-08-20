/**
 * Data access for AI Media Services (sv_service_projects / sv_service_quotes).
 *
 * These tables are newer than the generated Supabase types, so the client is
 * narrowed locally. All access is RLS-scoped — no service-role usage here and
 * no client-side status escalation: payment state is only ever written by the
 * verified Razorpay webhook.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AiServiceType, ServiceWorkflow } from "@/config/aiMediaServices";

export type ServiceProjectStatus =
  | "lead"
  | "intake"
  | "quoted"
  | "payment_pending"
  | "paid"
  | "production"
  | "human_qc"
  | "ready"
  | "delivered"
  | "cancelled";

export interface ServiceProject {
  id: string;
  user_id: string;
  service_type: AiServiceType;
  workflow: ServiceWorkflow;
  project_name: string;
  description: string | null;
  source_language: string | null;
  target_languages: string[] | null;
  rights_acknowledged: boolean;
  material_readiness: string | null;
  creator_type: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: ServiceProjectStatus;
  human_qc_completed_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceQuote {
  id: string;
  project_id: string;
  subtotal_paise: number;
  gst_paise: number;
  total_paise: number;
  currency: string;
  scope_summary: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  valid_until: string | null;
  created_at: string;
}

export interface ServiceOrderRow {
  id: string;
  status: string;
  total_paise: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
}

/** The generated types file does not know these tables yet. */
const db = supabase as unknown as {
  from: (table: string) => any;
};

export class ServiceApiError extends Error {}

export interface CreateProjectInput {
  service_type: AiServiceType;
  workflow: ServiceWorkflow;
  project_name: string;
  description: string;
  source_language: string;
  target_languages: string[];
  rights_acknowledged: boolean;
  material_readiness: string;
  creator_type: string;
  contact_email: string;
  contact_phone: string;
}

export async function createServiceProject(input: CreateProjectInput): Promise<ServiceProject> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new ServiceApiError("You must be signed in to start a project.");

  const { data, error } = await db
    .from("sv_service_projects")
    .insert({ ...input, user_id: uid, status: "intake" })
    .select("*")
    .single();

  if (error) throw new ServiceApiError(error.message);
  return data as ServiceProject;
}

export async function listMyServiceProjects(): Promise<ServiceProject[]> {
  const { data, error } = await db
    .from("sv_service_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new ServiceApiError(error.message);
  return (data ?? []) as ServiceProject[];
}

export async function getServiceProject(id: string): Promise<ServiceProject | null> {
  const { data, error } = await db.from("sv_service_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceApiError(error.message);
  return (data as ServiceProject) ?? null;
}

/** Customers may only ever see an accepted quote that genuinely exists. */
export async function getAcceptedQuote(projectId: string): Promise<ServiceQuote | null> {
  const { data, error } = await db
    .from("sv_service_quotes")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new ServiceApiError(error.message);
  const rows = (data ?? []) as ServiceQuote[];
  return rows[0] ?? null;
}

export async function listProjectQuotes(projectId: string): Promise<ServiceQuote[]> {
  const { data, error } = await db
    .from("sv_service_quotes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceApiError(error.message);
  return (data ?? []) as ServiceQuote[];
}

/** Verified payment record for a project — the only source of "paid". */
export async function getPaidOrder(projectId: string): Promise<ServiceOrderRow | null> {
  const { data, error } = await db
    .from("service_orders")
    .select("id,status,total_paise,razorpay_order_id,razorpay_payment_id,paid_at,created_at")
    .eq("service_project_id", projectId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new ServiceApiError(error.message);
  const rows = (data ?? []) as ServiceOrderRow[];
  return rows[0] ?? null;
}

export async function listProjectOrders(projectId: string): Promise<ServiceOrderRow[]> {
  const { data, error } = await db
    .from("service_orders")
    .select("id,status,total_paise,razorpay_order_id,razorpay_payment_id,paid_at,created_at")
    .eq("service_project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceApiError(error.message);
  return (data ?? []) as ServiceOrderRow[];
}

export function formatPaise(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export const SERVICE_STAGES: { key: string; label: string; statuses: ServiceProjectStatus[] }[] = [
  { key: "lead", label: "Lead", statuses: ["lead"] },
  { key: "intake", label: "Intake", statuses: ["intake"] },
  { key: "rights", label: "Rights", statuses: ["intake"] },
  { key: "quote", label: "Quote", statuses: ["quoted"] },
  { key: "payment", label: "Payment", statuses: ["payment_pending"] },
  { key: "production", label: "Production", statuses: ["paid", "production"] },
  { key: "qc", label: "Human QC", statuses: ["human_qc"] },
  { key: "delivery", label: "Delivery", statuses: ["ready", "delivered"] },
];

export function stageIndexForStatus(status: ServiceProjectStatus): number {
  switch (status) {
    case "lead":
      return 0;
    case "intake":
      return 2;
    case "quoted":
      return 3;
    case "payment_pending":
      return 4;
    case "paid":
    case "production":
      return 5;
    case "human_qc":
      return 6;
    case "ready":
    case "delivered":
      return 7;
    default:
      return 0;
  }
}

export function nextRequiredAction(
  project: ServiceProject,
  hasAcceptedQuote: boolean,
  hasPaidOrder: boolean,
): string {
  if (project.status === "cancelled") return "This project was cancelled. Start a new project to continue.";
  if (!project.rights_acknowledged) return "Confirm the rights acknowledgement for this project.";
  if (!hasAcceptedQuote && !hasPaidOrder) return "Waiting for the StreamVista team to prepare and confirm your quote.";
  if (!hasPaidOrder) return "Payment required before production begins.";
  if (project.status === "paid") return "Payment verified. The production team will start work.";
  if (project.status === "production") return "In production. Nothing needed from you right now.";
  if (project.status === "human_qc") return "In human quality control review.";
  if (project.status === "ready") return "Approved and ready — delivery is being released.";
  if (project.status === "delivered") return "Delivered.";
  return "Waiting on the StreamVista team.";
}
