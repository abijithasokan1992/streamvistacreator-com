/**
 * TechnicalDetailsDisclosure — reusable "View Technical Details" collapsible.
 *
 * Purpose: keep developer-only fields (order_id, payment_id, topup_id, user_id,
 * callback / webhook / browser origin / synthetic verify, raw event names such
 * as `payment.captured`, raw error codes such as `BAD_REQUEST_ERROR`, internal
 * identifiers such as `studio_vault`) off the primary admin surface while
 * still letting support staff reveal them on demand.
 *
 * The normal payment row shows only: customer, amount, date, payment status,
 * recommended action. Everything else lives inside this disclosure.
 */
import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ADMIN_LABELS } from "@/lib/copy/adminLabels";

export interface TechnicalDetailEntry {
  label: string;
  value: ReactNode;
  /** Render the value in a monospace font (IDs, hashes, raw event names). */
  mono?: boolean;
}

export interface TechnicalDetailsDisclosureProps {
  /** Rows shown once the disclosure is expanded. */
  entries?: TechnicalDetailEntry[];
  /** Free-form technical content (e.g. a raw JSON payload). */
  children?: ReactNode;
  /** Optional heading rendered inside the expanded panel. */
  title?: string;
  /** Marks the parent record as a synthetic / test entry. */
  testRecord?: boolean;
  /** Optional wrapper className. */
  className?: string;
  /** Start expanded. Default: collapsed. */
  defaultOpen?: boolean;
}

export default function TechnicalDetailsDisclosure({
  entries,
  children,
  title,
  testRecord,
  className,
  defaultOpen = false,
}: TechnicalDetailsDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasEntries = (entries?.length ?? 0) > 0;
  const hasChildren = Boolean(children);
  if (!hasEntries && !hasChildren && !testRecord) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mt-2", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {testRecord && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {ADMIN_LABELS.testRecord}
          </Badge>
        )}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            {open ? ADMIN_LABELS.hideTechnicalDetails : ADMIN_LABELS.viewTechnicalDetails}
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
          {title && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {title}
            </div>
          )}
          {hasEntries && (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
              {entries!.map((entry, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted-foreground">{entry.label}</dt>
                  <dd
                    className={cn(
                      "text-foreground break-all",
                      entry.mono && "font-mono text-[11px]",
                    )}
                  >
                    {entry.value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {children && <div className="pt-1">{children}</div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
