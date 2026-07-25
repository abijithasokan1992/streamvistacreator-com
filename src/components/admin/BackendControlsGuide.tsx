import { Table, Shield, Users, Code, HardDrive, KeyRound, ScrollText, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    icon: Table,
    title: "Tables",
    path: "Backend → Database → Tables",
    description: "Browse every public table, inspect columns, row counts, and indexes.",
  },
  {
    icon: Shield,
    title: "RLS policies",
    path: "Backend → Database → RLS Policies",
    description: "View and edit row-level security rules for each table.",
  },
  {
    icon: Users,
    title: "Auth users",
    path: "Backend → Users",
    description: "See registered users, their roles, sessions, and auth providers.",
  },
  {
    icon: Code,
    title: "Edge Functions",
    path: "Backend → Edge Functions",
    description: "Deploy, inspect logs, and manage environment secrets for serverless functions.",
  },
  {
    icon: HardDrive,
    title: "Storage",
    path: "Backend → Storage",
    description: "Manage buckets, file policies, and public/private access rules.",
  },
  {
    icon: KeyRound,
    title: "Secrets",
    path: "Backend → Secrets",
    description: "Add or rotate runtime secrets used by edge functions and backend code.",
  },
  {
    icon: ScrollText,
    title: "Logs",
    path: "Backend → Edge Functions → Logs",
    description: "Search function logs and API request traces for debugging.",
  },
];

export function BackendControlsGuide({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/50 bg-card overflow-hidden", className)}>
      <header className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Backend controls guide</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Where to find each control inside the Lovable Cloud Backend view.
          </p>
        </div>
      </header>

      <ul className="divide-y divide-border/40">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="px-4 py-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-secondary/50 grid place-items-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground hidden sm:inline-block">
                    {item.path}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 border-t border-border/40 bg-secondary/20">
        <p className="text-xs text-muted-foreground">
          Open the Backend view from the top navigation (More → Cloud → Backend) or the chat action above.
        </p>
      </div>
    </div>
  );
}
