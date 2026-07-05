/**
 * RoleLegend — inline popover explaining what each role can do.
 *
 * Renders a small "?" trigger. Sourced from the canonical vocabulary in
 * `src/lib/rbac/labels.ts` so every screen uses identical wording.
 */
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  INVITABLE_ORG_ROLES,
  ORG_ROLE_DESCRIPTION,
  ORG_ROLE_LABEL,
  PRODUCTION_ROLES,
  PRODUCTION_ROLE_DESCRIPTION,
  PRODUCTION_ROLE_LABEL,
  type OrgRole,
  type ProductionRole,
} from "@/lib/rbac/labels";

type Kind = "org" | "production";

export function RoleLegend({
  kind,
  label = "What do these roles mean?",
  compact = false,
}: {
  kind: Kind;
  label?: string;
  compact?: boolean;
}) {
  const entries =
    kind === "org"
      ? (INVITABLE_ORG_ROLES as OrgRole[]).map((r) => ({
          key: r,
          name: ORG_ROLE_LABEL[r],
          desc: ORG_ROLE_DESCRIPTION[r],
        }))
      : (PRODUCTION_ROLES as ProductionRole[]).map((r) => ({
          key: r,
          name: PRODUCTION_ROLE_LABEL[r],
          desc: PRODUCTION_ROLE_DESCRIPTION[r],
        }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-7 w-7 text-muted-foreground" : "h-7 gap-1 text-xs text-muted-foreground"}
          aria-label={label}
        >
          <Info className="h-3.5 w-3.5" />
          {!compact && <span>Role legend</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-96 overflow-auto">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
          {kind === "org" ? "Organization Roles" : "Production Roles"}
        </p>
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.key} className="text-xs">
              <div className="font-medium text-foreground">{e.name}</div>
              <div className="text-muted-foreground leading-snug">{e.desc}</div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
