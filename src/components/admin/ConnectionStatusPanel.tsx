import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectionStatusPanel({ className }: { className?: string }) {
  const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "—";
  const backendUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "—";

  return (
    <div className={cn("rounded-xl border border-border/50 bg-card p-4", className)}>
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-muted-foreground" />
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Backend connection</div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Project ref</span>
          <span className="text-xs font-mono font-medium text-foreground truncate" title={projectRef}>
            {projectRef}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Connection mode</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Lovable Cloud managed
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Endpoint</span>
          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]" title={backendUrl}>
            {backendUrl}
          </span>
        </div>
      </div>
    </div>
  );
}
