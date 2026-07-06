import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogOut, ArrowRight, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole, type AppRole } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

/**
 * "My Workspace" — a read-only, minimal overview shown:
 *   • After first login / account creation (via AuthCallback → ?first=1)
 *   • Anytime from the profile menu link in each dashboard header
 *
 * Fully skippable. Never blocks the app. Uses live data only.
 */

type Status = "ready" | "setup" | "included" | "upgrade" | "soon";

const STATUS_STYLE: Record<Status, { dot: string; label: string; text: string }> = {
  ready:    { dot: "🟢", label: "Ready",            text: "text-emerald-300" },
  setup:    { dot: "🟡", label: "Complete Setup",   text: "text-amber-300" },
  included: { dot: "🔵", label: "Included",         text: "text-sky-300" },
  upgrade:  { dot: "🔒", label: "Upgrade Required", text: "text-fuchsia-300" },
  soon:     { dot: "⚪", label: "Coming Soon",      text: "text-muted-foreground" },
};

type SectionItem = { title: string; description: string; status: Status; hint?: string };

/** Map raw AppRole to a friendly workspace label — never expose role names. */
function workspaceTitle(role: AppRole | null): string {
  switch (role) {
    case "studio":        return "Your Studio Workspace";
    case "buyer":         return "Your Acquisition Workspace";
    case "admin":         return "Platform Management";
    case "super_admin":   return "Platform Operations";
    case "qc_reviewer":
    case "legal_reviewer":
      return "Platform Management";
    case "content_owner":
    case "creator":
    case "executive_producer":
    default:              return "Your Creative Workspace";
  }
}

/** Categorize the role into one of five UI buckets. */
type Bucket = "creator" | "studio" | "buyer" | "admin_ops" | "admin_mgmt";
function bucketFor(role: AppRole | null): Bucket {
  switch (role) {
    case "studio": return "studio";
    case "buyer": return "buyer";
    case "super_admin": return "admin_ops";
    case "admin":
    case "qc_reviewer":
    case "legal_reviewer":
      return "admin_mgmt";
    default: return "creator";
  }
}

export default function MyWorkspace() {
  const { user, role, loading, signOut } = useAuth();
  const { active } = useWorkspaces();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || dashboardForRole(role);
  const isFirst = params.get("first") === "1";

  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [sections, setSections] = useState<SectionItem[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const bucket = bucketFor(role);

      // Shared: profile completeness, plan/storage summary (creator + studio + buyer).
      const [prof, pa, alloc, titles, workspaces] = await Promise.all([
        supabase.from("user_profiles")
          .select("display_name, studio_name, first_name, last_name, phone_e164, country_code, onboarding_step, plan_tier")
          .eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("plan_assignments")
          .select("plan:plans(name, storage_gb)")
          .eq("user_id", user.id).eq("status", "active")
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("storage_allocations").select("allocated_gb").eq("user_id", user.id),
        supabase.from("content_titles").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
        (supabase as any).from("workspace_members").select("workspace_id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (cancelled) return;

      const p: any = prof.data ?? {};
      const name = active?.name || p.studio_name || p.display_name || user.email?.split("@")[0] || "there";
      setDisplayName(name);

      const profileComplete = !!(p.display_name && p.phone_e164 && p.country_code);
      const planName: string = pa.data?.plan?.name || (p.plan_tier && p.plan_tier !== "free"
        ? p.plan_tier.charAt(0).toUpperCase() + p.plan_tier.slice(1)
        : "Free");
      const isFree = planName.toLowerCase() === "free" || !pa.data;
      const allocatedGb =
        (alloc.data ?? []).reduce((a: number, r: any) => a + Number(r.allocated_gb || 0), 0)
        + Number(pa.data?.plan?.storage_gb || 0);
      const titleCount = titles.count ?? 0;
      const wsCount = workspaces.count ?? 0;

      const items: SectionItem[] = [];

      // Identity — always ready if user is signed in.
      items.push({
        title: "Workspace Identity",
        description: `Signed in as ${user.email ?? "your account"}${active?.name ? ` · ${active.name}` : ""}.`,
        status: "ready",
      });

      // Profile
      items.push({
        title: "Your Profile",
        description: profileComplete
          ? "Contact and identity details are complete."
          : "Add your name, phone and country to unlock invoicing and delivery.",
        status: profileComplete ? "ready" : "setup",
      });

      if (bucket === "creator" || bucket === "studio" || bucket === "buyer") {
        items.push({
          title: "Plan",
          description: isFree
            ? "You're on the Free tier. Upgrade for higher storage limits and premium tools."
            : `${planName} is active on this account.`,
          status: isFree ? "upgrade" : "included",
        });

        items.push({
          title: "Storage",
          description: allocatedGb > 0
            ? `${allocatedGb.toFixed(0)} GB allocated to your workspace.`
            : "No storage allocated yet — a Free allowance is applied on first upload.",
          status: allocatedGb > 0 ? "included" : "setup",
        });
      }

      if (bucket === "creator") {
        items.push({
          title: "Your Titles",
          description: titleCount > 0
            ? `${titleCount} title${titleCount === 1 ? "" : "s"} in your library.`
            : "No titles yet. Add your first film or show from the Titles section.",
          status: titleCount > 0 ? "ready" : "setup",
        });
      }
      if (bucket === "studio") {
        items.push({
          title: "Productions",
          description: wsCount > 0
            ? `${wsCount} production workspace${wsCount === 1 ? "" : "s"} available.`
            : "Create your first production to start ingesting media.",
          status: wsCount > 0 ? "ready" : "setup",
        });
        items.push({
          title: "Media Ingest Engine",
          description: "Read-only import from cameras, cards, drives and NAS with checksum verification.",
          status: "included",
        });
      }
      if (bucket === "buyer") {
        items.push({
          title: "Acquisition Requests",
          description: "Browse the catalogue and submit acquisition requests to rights holders.",
          status: "included",
        });
      }
      if (bucket === "admin_mgmt" || bucket === "admin_ops") {
        items.push({
          title: bucket === "admin_ops" ? "Platform Operations Console" : "Platform Management Console",
          description: "Users, approvals, billing, storage, communications and audit.",
          status: "ready",
        });
        items.push({
          title: "Integrations",
          description: "Payment, email, storage and identity providers.",
          status: "included",
        });
      }

      // Universal footer items.
      items.push({
        title: "Security & Sign-in",
        description: "Password, magic links and OAuth are active on your account.",
        status: "ready",
      });
      items.push({
        title: "Insights & Analytics",
        description: "Deeper usage reports and creator insights.",
        status: "soon",
      });

      setSections(items);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, role, active?.id]);

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const title = workspaceTitle(role);

  const goNext = () => {
    try {
      if (user) localStorage.setItem(`sv:seen-workspace-intro:${user.id}`, "1");
    } catch { /* noop */ }
    navigate(next, { replace: true });
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold tracking-tight">StreamVista</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
          {isFirst ? "Welcome" : "Your overview"}
        </p>
        <h1 className="font-display text-3xl md:text-4xl mt-2">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          {isFirst
            ? `Nice to meet you, ${displayName}. Here's a quick look at what's ready and what's next.`
            : `A read-only overview of what's active for ${displayName}.`}
        </p>

        <section className="mt-10 space-y-3">
          {!ready && (
            <div className="rounded-2xl border border-border/40 bg-secondary/10 h-40 animate-pulse" />
          )}
          {ready && sections.map((s) => {
            const st = STATUS_STYLE[s.status];
            return (
              <div
                key={s.title}
                className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">{s.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-lg">{s.description}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] ${st.text}`}
                  aria-label={st.label}
                >
                  <span aria-hidden>{st.dot}</span>
                  <span>{st.label}</span>
                </span>
              </div>
            );
          })}
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button onClick={goNext} className="gap-2">
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={goNext} className="gap-2 text-muted-foreground">
            <SkipForward className="w-4 h-4" /> Skip for now
          </Button>
          <p className="text-[11px] text-muted-foreground/70 ml-auto">
            You can open this overview any time from your profile menu.
          </p>
        </div>
      </div>
    </main>
  );
}
