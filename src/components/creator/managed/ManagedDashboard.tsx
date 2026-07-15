import { Link } from "react-router-dom";
import {
  Activity, Bell, CheckCircle2, ClipboardList, CreditCard, Download, Truck,
  UploadCloud, Loader2, ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type TileKey =
  | "status" | "upload" | "messages" | "approvals"
  | "billing" | "timeline" | "delivery" | "reports";

const TILES: Array<{
  key: TileKey; title: string; description: string; icon: any; to: string;
}> = [
  { key: "status",    title: "Project Status",  description: "Where each of your titles is right now.",         icon: Activity,     to: "/dashboard/content?section=titles" },
  { key: "upload",    title: "Upload",          description: "Send masters, artwork, subtitles and reference files.", icon: UploadCloud, to: "/dashboard/content?section=delivery_vault" },
  { key: "messages",  title: "Messages",        description: "Notes from your assigned StreamVista team.",       icon: Bell,         to: "/dashboard/content?section=messages" },
  { key: "approvals", title: "Approvals",       description: "Milestones waiting for your sign-off.",            icon: CheckCircle2, to: "/dashboard/content?section=activity" },
  { key: "billing",   title: "Billing",         description: "Service fees, storage and invoices.",              icon: CreditCard,   to: "/dashboard/content?section=billing" },
  { key: "timeline",  title: "Timeline",        description: "Milestones and target dates for each title.",      icon: ClipboardList, to: "/dashboard/content?section=activity" },
  { key: "delivery",  title: "Delivery Status", description: "Distribution progress by partner.",                icon: Truck,        to: "/dashboard/content?section=distribution" },
  { key: "reports",   title: "Reports",         description: "Download delivery and performance reports.",       icon: Download,     to: "/dashboard/content?section=statements" },
];

export default function ManagedDashboard() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count: c } = await supabase
        .from("managed_projects")
        .select("content_title_id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      setCount(c ?? 0);
    })();
  }, [user?.id]);

  return (
    <div>
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Managed by StreamVista</p>
        <h1 className="font-display text-2xl md:text-3xl mt-2">
          Your projects. Our operations team.
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Upload media, approve milestones and track progress. StreamVista handles metadata,
          QC, packaging, distribution and delivery.
          {count === null ? (
            <span className="inline-flex items-center ml-2 opacity-70">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> loading…
            </span>
          ) : (
            <span className="ml-2 text-foreground/80">{count} active {count === 1 ? "project" : "projects"}.</span>
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map(({ key, title, description, icon: Icon, to }) => (
          <Link
            key={key}
            to={to}
            className="group rounded-2xl border border-border/50 bg-secondary/10 p-5 hover:bg-secondary/20 hover:border-accent/30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            <Icon className="w-5 h-5 text-accent" />
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
            <span className="mt-3 inline-flex items-center text-[11px] text-muted-foreground group-hover:text-foreground">
              Open <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border/50 bg-secondary/[0.05] p-5">
        <p className="text-xs text-muted-foreground">
          Need every advanced control (metadata editor, packaging, distribution settings)?{" "}
          <Link to="/my-workspace" className="text-accent hover:underline">
            Switch to Self-Service in Workspace Settings
          </Link>.
        </p>
      </div>
    </div>
  );
}
