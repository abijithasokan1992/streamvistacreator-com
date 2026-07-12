import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";

/**
 * StageGate — gates a UI region on Role × Plan × Title Status.
 *
 * All three inputs are evaluated (AND). Failures render either the fallback
 * or a lightweight locked chip so creators get honest visibility without the
 * technical module itself.
 *
 * Example:
 *   <StageGate
 *      allowRoles={["studio","admin","super_admin"]}
 *      allowPlans={["creator_paid","studio_pro"]}
 *      minStatus="approved"
 *      titleStatus={t.status}
 *      planCode={planCode}
 *   >
 *     <PartnerDispatchPanel/>
 *   </StageGate>
 */

// Title lifecycle order — indices are used for `minStatus` comparisons.
const STATUS_ORDER = [
  "draft","incomplete","submitted","in_review","qc_review","legal_review",
  "changes_requested","hold","approved","ready_for_distribution","locked",
  "published","archived","rejected",
] as const;

export type TitleStatus = typeof STATUS_ORDER[number];

function statusReached(current: string | null | undefined, min: TitleStatus): boolean {
  if (!current) return false;
  const c = STATUS_ORDER.indexOf(current as TitleStatus);
  const m = STATUS_ORDER.indexOf(min);
  return c >= 0 && m >= 0 && c >= m;
}

export type StageGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Roles allowed to view the gated region. Admin roles bypass all checks. */
  allowRoles?: AppRole[];
  /** Plan codes allowed. Omit to skip plan check. */
  allowPlans?: string[];
  /** Current plan code (from entitlement). */
  planCode?: string | null;
  /** Minimum title status required for the region. */
  minStatus?: TitleStatus;
  /** Current title status. */
  titleStatus?: string | null;
  /** Optional label shown in the locked chip. */
  label?: string;
};

const ADMIN_ROLES: AppRole[] = ["admin","super_admin","qc_reviewer","legal_reviewer"];

export function StageGate({
  children, fallback,
  allowRoles, allowPlans, planCode,
  minStatus, titleStatus,
  label = "Available after review",
}: StageGateProps) {
  const { role } = useAuth();

  const isAdmin = role != null && ADMIN_ROLES.includes(role);
  const roleOk  = isAdmin || !allowRoles || (role != null && allowRoles.includes(role));
  const planOk  = !allowPlans || (planCode != null && allowPlans.includes(planCode));
  const statusOk = !minStatus || statusReached(titleStatus, minStatus);

  if (isAdmin || (roleOk && planOk && statusOk)) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div
      role="status"
      aria-label={label}
      className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-center gap-3 text-sm text-muted-foreground"
    >
      <Lock className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export default StageGate;
