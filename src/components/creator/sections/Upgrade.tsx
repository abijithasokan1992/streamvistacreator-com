import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Crown, Database, Check, LifeBuoy, HardDrive, Plus, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";

/**
 * Creator Upgrade — two clearly separated commercial surfaces:
 *
 *   Section 1: Creator Plans (Basic / Pro / Studio)
 *     • founder-assisted, request flow writes to support_requests.metadata.
 *
 *   Section 2: Creator Storage Add-ons
 *     • self-serve recurring Razorpay subscription, 1 TB blocks at ₹767/mo
 *       (₹650 + 18% GST), priced server-side.
 *     • Each block = one Razorpay subscription row; entitlement is the SUM
 *       of active blocks. "Add 1 TB" creates an additional independent
 *       subscription so cancellation of one block does not nuke the rest.
 *     • Cancellation is end-of-cycle, never destructive.
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

const STORAGE_PRICE_BASE_INR = 650;
const STORAGE_PRICE_INC_GST_INR = 767; // ₹650 + 18% GST — display only; server is source of truth.

type StorageEntitlement = {
  included_gb: number;
  paid_tb: number;
  paid_gb: number;
  admin_gb: number;
  total_gb: number;
  used_gb: number;
  over_quota: boolean;
  active_storage_subscriptions: number;
  monthly_paise: number;
  cancelling_tb?: number;
  next_period_end?: string | null;
  halted_subscriptions?: number;
  projected_total_gb_after_cancellations?: number;
  projected_over_quota_after_cancellations?: boolean;
};

type StorageSub = {
  id: string;
  razorpay_subscription_id: string | null;
  storage_quantity_tb: number | null;
  unit_amount_paise: number | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  cancel_requested_at: string | null;
  created_at: string;
};

function fmtINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function UpgradeSection() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [titleCount, setTitleCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<PackageKey>("creator_pro_managed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // ── Section 2 state ─────────────────────────────
  const [entitlement, setEntitlement] = useState<StorageEntitlement | null>(null);
  const [storageSubs, setStorageSubs] = useState<StorageSub[]>([]);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageLoading, setStorageLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [a, prof, titles, ent, subs] = await Promise.all([
      (supabase as any).from("plan_assignments")
        .select("*, plan:plans(*)").eq("user_id", user.id).eq("status", "active")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("user_profiles").select("plan_tier, topup_tb").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("content_titles").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
      (supabase as any).rpc("get_creator_storage_entitlement", { _user_id: user.id }),
      (supabase as any).from("subscriptions")
        .select("id, razorpay_subscription_id, storage_quantity_tb, unit_amount_paise, status, current_period_end, cancel_at_period_end, cancel_requested_at, created_at")
        .eq("user_id", user.id)
        .eq("subscription_type", "creator_storage")
        .order("created_at", { ascending: false }),
    ]);
    setPlan(a.data); setProfile(prof.data);
    setTitleCount(titles.count ?? 0);
    const row = Array.isArray(ent.data) ? ent.data[0] : ent.data;
    if (row) setEntitlement(row as StorageEntitlement);
    setStorageSubs((subs.data ?? []) as StorageSub[]);
    setStorageLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const currentPlanName: string =
    plan?.plan?.name || profile?.plan_tier || "Creator Basic";

  const submitRequest = async () => {
    if (!user) return;
    const pkg = PACKAGES.find((p) => p.key === selected);
    const label = pkg?.name ?? "Custom";
    setBusy(true);
    try {
      const metadata = {
        kind: "creator_upgrade",
        surface: "creator",
        request_kind: "plan_change",
        requested_package_key: selected,
        requested_package_name: label,
        requested_plan: label,
        current_plan: currentPlanName,
        current_plan_name: currentPlanName,
        current_plan_assignment_id: plan?.id ?? null,
        current_title_count: titleCount,
        current_storage_gb: entitlement?.used_gb ?? null,
        creator_note: note.trim() || null,
        submitted_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("support_requests").insert({
        user_id: user.id,
        request_type: "plan_upgrade",
        subject: `Creator plan change request — ${label}`,
        message:
          `Requested package: ${label}\n` +
          `Current plan: ${currentPlanName}\n` +
          `Current titles: ${titleCount ?? "—"}\n` +
          `Current storage used: ${entitlement?.used_gb ?? "—"} GB\n\n` +
          (note.trim() ? `Notes from creator:\n${note.trim()}` : "No additional notes provided."),
        status: "open",
        metadata,
      });
      if (error) throw error;
      toast.success("Plan change request submitted. Our team will reach out by email.");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit request.");
    } finally { setBusy(false); }
  };

  // ── Storage subscription actions ─────────────────────────
  const openRazorpaySubscription = async (label: string) => {
    if (!user) return;
    setStorageBusy(true);
    const t = toast.loading("Opening Razorpay…");
    try {
      assertLiveCheckoutHost();
      const { data, error } = await supabase.functions.invoke("create-razorpay-subscription", {
        body: { tbCount: 1 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      await new Promise<void>((resolve) => {
        if ((window as any).Razorpay) return resolve();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });

      const rzp = new (window as any).Razorpay({
        key: (data as any).keyId,
        subscription_id: (data as any).subscriptionId,
        name: "StreamVista Creator Storage",
        description: `${label} · 1 TB / month`,
        prefill: { email: user.email },
        theme: { color: "#a855f7" },
        handler: async () => {
          toast.success("Storage subscription activated 🎉");
          // Webhook persists authoritative state; refresh after a beat.
          setTimeout(() => loadAll(), 1500);
        },
      });
      toast.dismiss(t);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Could not start subscription", { id: t });
    } finally {
      setStorageBusy(false);
    }
  };

  const cancelStorage = async (sub: StorageSub) => {
    if (!sub.razorpay_subscription_id) return;
    if (!confirm(
      "Cancel this 1 TB storage block at the end of the current billing cycle?\n\n" +
      "• You keep access until the cycle ends.\n" +
      "• No further renewals will be charged for this block.\n" +
      "• If your used storage exceeds your remaining allowance after the cycle ends, uploads will be paused until you add storage or reduce usage.\n\n" +
      "Files are never deleted automatically."
    )) return;
    setStorageBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-creator-storage", {
        body: { subscriptionId: sub.razorpay_subscription_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Cancellation scheduled — active until cycle end.");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Could not cancel subscription.");
    } finally {
      setStorageBusy(false);
    }
  };

  // ── Derived storage display ───────────────────
  const totalMonthlyPaise = storageSubs
    .filter((s) => ["active", "authenticated", "charged", "resumed"].includes(s.status) && !s.cancel_at_period_end)
    .reduce((acc, s) => acc + (s.unit_amount_paise ?? 0) * (s.storage_quantity_tb ?? 1), 0);

  const activeBlocks = storageSubs.filter((s) =>
    ["active", "authenticated", "charged", "resumed", "created", "pending"].includes(s.status)
  );
  const hasActivePaid = activeBlocks.length > 0;
  const nextRenewal = activeBlocks
    .map((s) => s.current_period_end)
    .filter(Boolean)
    .sort()[0];

  return (
    <div className="space-y-8">
      {/* ─────────── SECTION 1 — Plans (founder-assisted) ─────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold font-display">Plan &amp; workspace access</h2>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Founder-assisted</span>
        </div>

        <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-xs text-muted-foreground">
          Creator plans are <span className="text-foreground font-medium">founder-assisted</span> — pick a package,
          tell us what you need, and our team confirms pricing and provisions your account by email.
          Extra storage (below) is self-serve and billed monthly in 1 TB blocks.
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Crown className="w-3.5 h-3.5" /> Current Plan</div>
            <div className="text-xl font-semibold font-display mt-2">{currentPlanName}</div>
            {plan?.status && <p className="text-[11px] text-muted-foreground mt-1">Status: {plan.status}</p>}
          </div>
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="w-3.5 h-3.5" /> Total Storage Allowance</div>
            <div className="text-xl font-semibold font-display mt-2">
              {entitlement ? `${entitlement.total_gb} GB` : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {entitlement
                ? `Included ${entitlement.included_gb} GB · Paid ${entitlement.paid_tb} TB · Admin ${entitlement.admin_gb} GB`
                : "Plan baseline plus any admin grants."}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Choose a package to request</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Managed packages — pricing confirmed by our team based on your catalog and needs.
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
        </div>

        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="w-4 h-4" /> Request plan change
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
            placeholder="E.g. 'Around 8 active titles, need delivery by Q3.'"
            className="mt-3 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={submitRequest}
            disabled={busy}
            className="mt-3 inline-flex rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Request Plan Change"}
          </button>
        </div>
      </section>

      {/* ─────────── SECTION 2 — Storage add-ons (self-serve) ─────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold font-display">Storage add-ons</h2>
          <span className="text-[11px] uppercase tracking-widest text-accent">Self-serve · Recurring</span>
        </div>

        {/* Entitlement summary */}
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5 grid sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Included</p>
            <p className="text-base font-semibold mt-1">{entitlement?.included_gb ?? 50} GB</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Paid storage</p>
            <p className="text-base font-semibold mt-1">{entitlement?.paid_tb ?? 0} TB</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total available</p>
            <p className="text-base font-semibold mt-1">{entitlement?.total_gb ?? "—"} GB</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Monthly recurring</p>
            <p className="text-base font-semibold mt-1">
              {totalMonthlyPaise > 0 ? `${fmtINR(totalMonthlyPaise)} /mo` : "—"}
            </p>
          </div>
        </div>

        {entitlement?.over_quota && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Account is over quota — new uploads are blocked.</p>
              <p className="mt-1 text-destructive/90">
                Your used storage ({entitlement.used_gb} GB) exceeds your current allowance ({entitlement.total_gb} GB).
                Existing files are preserved. Add another 1 TB block below or reduce usage to resume uploads.
              </p>
            </div>
          </div>
        )}

        {(entitlement?.halted_subscriptions ?? 0) > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-100">
                Payment issue on {entitlement!.halted_subscriptions} storage block{entitlement!.halted_subscriptions! > 1 ? "s" : ""}.
              </p>
              <p className="mt-1">
                Your existing files are safe, but the affected block no longer contributes to your storage allowance.
                Add a fresh 1 TB block below to restore capacity, or contact support if you need help reactivating the original subscription.
              </p>
            </div>
          </div>
        )}

        {!entitlement?.over_quota
          && entitlement?.projected_over_quota_after_cancellations
          && (entitlement?.cancelling_tb ?? 0) > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-100">
                Scheduled cancellation will leave you over quota
                {entitlement?.next_period_end ? ` on ${new Date(entitlement.next_period_end).toLocaleDateString()}` : ""}.
              </p>
              <p className="mt-1">
                After the cycle ends your allowance drops from {entitlement.total_gb} GB to{" "}
                {entitlement.projected_total_gb_after_cancellations} GB — below your current usage of {entitlement.used_gb} GB.
                Add storage or reduce usage before then to keep uploads flowing.
              </p>
            </div>
          </div>
        )}

        {/* Product card */}
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HardDrive className="w-4 h-4 text-accent" /> Creator Storage Add-on
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                1 TB per block · ₹{STORAGE_PRICE_BASE_INR} + 18% GST = <b className="text-foreground">₹{STORAGE_PRICE_INC_GST_INR}/month</b> · recurring monthly
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                You explicitly add blocks — no silent auto-charge. Cancel any block at end of cycle.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!hasActivePaid && (
                <button
                  onClick={() => openRazorpaySubscription("Start storage subscription")}
                  disabled={storageBusy || storageLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-2 disabled:opacity-50"
                >
                  {storageBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Start 1 TB Storage Subscription
                </button>
              )}
              {hasActivePaid && (
                <button
                  onClick={() => openRazorpaySubscription("Add 1 TB")}
                  disabled={storageBusy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-2 disabled:opacity-50"
                >
                  {storageBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add 1 TB
                </button>
              )}
            </div>
          </div>

          {nextRenewal && (
            <p className="text-[11px] text-muted-foreground mt-3">
              Next renewal: <span className="text-foreground">{new Date(nextRenewal).toLocaleDateString()}</span>
            </p>
          )}
        </div>

        {/* Active blocks list */}
        {hasActivePaid && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Your storage subscriptions</h3>
            {storageSubs.map((s) => {
              const cancelling = s.cancel_at_period_end || !!s.cancel_requested_at;
              const cycleEnd = s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—";
              return (
                <div key={s.id} className="rounded-lg border border-border/40 bg-secondary/5 p-3 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {s.storage_quantity_tb ?? 1} TB block · {fmtINR((s.unit_amount_paise ?? 0) * (s.storage_quantity_tb ?? 1))}/mo
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Status: <span className="text-foreground">{s.status}</span>
                      {" · "}Period ends: {cycleEnd}
                      {cancelling && <span className="text-amber-400"> · Cancellation scheduled</span>}
                    </p>
                  </div>
                  {!cancelling && ["active", "authenticated", "charged", "resumed"].includes(s.status) && (
                    <button
                      onClick={() => cancelStorage(s)}
                      disabled={storageBusy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 text-xs px-2.5 py-1.5 hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" /> Cancel at cycle end
                    </button>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">
              Cancellation takes effect at the end of the current billing cycle. Files are never deleted automatically; if usage exceeds the new allowance after cancellation, uploads pause until you add storage or reduce usage.
            </p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Need heavy archival / production-grade storage? That belongs to{" "}
          <span className="text-foreground font-medium">Studio Vault</span>, not Creator.
        </p>
      </section>
    </div>
  );
}
