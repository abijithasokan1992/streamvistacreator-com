import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, RefreshCw, Users as UsersIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OrgKind = "creator" | "studio" | "buyer" | "channel_partner";
type OrgStatus = "draft" | "invited" | "onboarding" | "active" | "suspended";

interface OrgRow {
  id: string;
  name: string;
  org_kind: OrgKind;
  status: OrgStatus;
  published: boolean;
  domain_name: string | null;
  logo_url: string | null;
  created_at: string;
}

const KIND_LABEL: Record<OrgKind, string> = {
  creator: "Creator",
  studio: "Studio",
  buyer: "Buyer",
  channel_partner: "Channel Partner",
};

const KIND_TONE: Record<OrgKind, string> = {
  creator: "bg-accent/15 text-accent border-accent/40",
  studio: "bg-primary/15 text-primary border-primary/40",
  buyer: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  channel_partner: "bg-purple-500/15 text-purple-300 border-purple-500/40",
};

const STATUS_TONE: Record<OrgStatus, string> = {
  draft: "bg-muted/40 text-muted-foreground border-border/60",
  invited: "bg-accent/10 text-accent border-accent/30",
  onboarding: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  suspended: "bg-destructive/15 text-destructive border-destructive/40",
};

const KIND_FILTERS: Array<{ key: OrgKind | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "creator", label: "Creators" },
  { key: "studio", label: "Studios" },
  { key: "buyer", label: "Buyers" },
  { key: "channel_partner", label: "Channel Partners" },
];

export default function OrganizationsConsole() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<OrgKind | "all">("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("organizations")
      .select("id, name, org_kind, status, published, domain_name, logo_url, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Could not load organizations"); return; }
    setRows((data ?? []) as OrgRow[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.org_kind !== kind) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.domain_name ?? "").toLowerCase().includes(q);
    });
  }, [rows, kind, query]);

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/10 p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon className="w-4 h-4 text-accent" />
          <h3 className="font-display text-lg font-semibold">Organizations</h3>
          <span className="text-xs text-muted-foreground">Single source of truth for every external org.</span>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40 flex items-center gap-1.5"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setKind(f.key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs border transition-colors",
              kind === f.key
                ? "bg-accent/20 border-accent/60 text-accent"
                : "border-border/50 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name / domain"
            className="pl-8 pr-3 py-1.5 rounded-md text-xs bg-background border border-border/60 focus:outline-none focus:border-accent w-56"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/20">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Public</th>
              <th className="text-left px-3 py-2">Domain</th>
              <th className="text-left px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading…
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No organizations match.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/20">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cn("text-[10px]", KIND_TONE[r.org_kind])}>
                    {KIND_LABEL[r.org_kind]}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[r.status])}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.published ? <span className="text-emerald-400">Published</span> : <span className="text-muted-foreground">Private</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.domain_name ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
