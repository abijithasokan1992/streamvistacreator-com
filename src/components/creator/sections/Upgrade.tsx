import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Database, Check, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Creator Commercial Model: A — Managed / Founder-Assisted.
 * No self-serve checkout. All upgrades flow through support_requests
 * and are operated by admin via the Support inbox.
 */

type PackageKey = "creator_basic" | "creator_pro_managed" | "creator_studio_managed" | "custom";

const PACKAGES: ReadonlyArray<{
  key: PackageKey;
  name: string;
  posture: string;
  titles: string;
  storage: string;
  workflow: string;
  highlight?: boolean;
}> = [
  {
    key: "creator_basic",
    name: "Creator Basic",
    posture: "Included by default",
    titles: "1 active title, 1 submission",
    storage: "50 GB included",
    workflow: "Standard review workflow",
  },
  {
    key: "creator_pro_managed",
    name: "Creator Pro (Managed)",
    posture: "Founder-assisted onboarding",
    titles: "Up to 10 active titles",
    storage: "Larger allowance, sized to your catalog",
    workflow: "Priority review, named contact",
    highlight: true,
  },
  {
    key: "creator_studio_managed",
    name: "Creator Studio (Managed)",
    posture: "Custom commercial terms",
    titles: "Unlimited titles, custom submission cadence",
    storage: "Custom storage; heavy archives via Studio Vault",
    workflow: "Dedicated workflow support, custom SLAs",
  },
];

export default function UpgradeSection() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [selected, setSelected] = useState<PackageKey>("creator_pro_managed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [a, alloc, prof] = await Promise.all([
        (supabase as any).from("plan_assignments")
          .select("*, plan:plans(*)").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("storage_allocations").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("user_profiles").select("plan_tier, topup_tb").eq("user_id", user.id).maybeSingle(),
      ]);
      setPlan(a.data); setAllocation(alloc.data); setProfile(prof.data);
    })();
  }, [user]);

  const submitRequest = async () => {
    if (!user) return;
    const pkg = PACKAGES.find((p) => p.key === selected);
    const label = pkg?.name ?? "Custom";
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("support_requests").insert({
        user_id: user.id,
        request_type: "upgrade",
        subject: `Creator upgrade request — ${label}`,
        message:
          `Requested package: ${label}\n\n` +
          (note.trim() ? `Notes from creator:\n${note.trim()}` : "No additional notes provided."),
        status: "open",
      });
      if (error) throw error;
      toast.success("Upgrade request submitted. Our team will reach out by email.");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit request.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {/* Honest commercial posture banner */}
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-xs text-muted-foreground">
        Creator plans are <span className="text-foreground font-medium">founder-assisted</span> today.
        Pick a package, tell us what you need, and our team will follow up by email to confirm pricing,
        provision your account and issue an invoice. There is no self-serve checkout for Creator yet.
      </div>

      {/* Current entitlement */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Crown className="w-3.5 h-3.5" /> Current Plan</div>
          <div className="text-xl font-semibold font-display mt-2">
            {plan?.plan?.name || profile?.plan_tier || "Creator Basic"}
          </div>
          {plan?.status && <p className="text-[11px] text-muted-foreground mt-1">Status: {plan.status}</p>}
        </div>
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="w-3.5 h-3.5" /> Storage Allowance</div>
          <div className="text-xl font-semibold font-display mt-2">
            {allocation?.allocated_gb != null
              ? `${allocation.allocated_gb} GB`
              : profile?.topup_tb
                ? `${(profile.topup_tb + 1)} TB`
                : "50 GB (Basic)"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Plan baseline plus any admin grants.</p>
        </div>
      </div>

      {/* Managed packages */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Choose a package to request</h3>
        <p className="text-xs text-muted-foreground mb-3">
          These are managed packages — pricing is confirmed by our team based on your catalog and needs.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {PACKAGES.map((p) => {
            const active = selected === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setSelected(p.key)}
                className={cn(
                  "text-left rounded-xl border p-4 transition-colors min-w-0",
                  active ? "border-accent/60 bg-accent/10" : "border-border/40 bg-secondary/5 hover:bg-secondary/15",
                  p.highlight && !active && "ring-1 ring-accent/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">{p.name}</p>
                  {active && <Check className="w-4 h-4 text-accent shrink-0" />}
                </div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{p.posture}</p>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li><span className="text-foreground">Titles:</span> {p.titles}</li>
                  <li><span className="text-foreground">Storage:</span> {p.storage}</li>
                  <li><span className="text-foreground">Workflow:</span> {p.workflow}</li>
                </ul>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Need heavy archival / production-grade storage? That belongs to{" "}
          <span className="text-foreground font-medium">Studio Vault</span>, not Creator.
        </p>
      </div>

      {/* Request form */}
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <LifeBuoy className="w-4 h-4" /> Submit upgrade request
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Tell us about your catalog size, timeline and any custom needs. We'll reply by email with
          pricing and next steps.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="E.g. 'Around 8 active titles, need delivery by Q3, will need ~2TB storage for masters.'"
          className="mt-3 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={submitRequest}
          disabled={busy}
          className="mt-3 inline-flex rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit Upgrade Request"}
        </button>
      </div>
    </div>
  );
}
