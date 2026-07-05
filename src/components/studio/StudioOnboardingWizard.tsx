/**
 * StudioOnboardingWizard — minimal 4-step activation flow.
 *
 * MVP scope: collects only the fields required to activate a Studio and
 * unlock the Production Control Center. Reuses `useEntityProfile` for all
 * persistence — no new tables, no new APIs. Fuller editing surface remains
 * at Settings > My Studio Profile.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Building2, Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useEntityProfile, type EntityProfile, type StudioExt } from "@/hooks/useEntityProfile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { COUNTRIES } from "@/lib/countries";
import { formatTaxId, formatPhone, validatePAN, validateGSTIN } from "@/lib/identityValidators";
import { cn } from "@/lib/utils";

const ENTITY_TYPES = [
  ["proprietorship", "Proprietorship"],
  ["partnership", "Partnership"],
  ["llp", "LLP"],
  ["pvt_ltd", "Private Limited"],
  ["public_ltd", "Public Limited"],
  ["trust", "Trust"],
  ["other", "Other"],
] as const;

// GST Place of Supply — Indian states + UTs. Used only when Country = India.
const INDIA_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

type Workspace = { id: string; name: string; role: string };

function useMyStudioWorkspaces() {
  const { user } = useAuth();
  const [list, setList] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("workspace_members")
        .select("role, workspace_id, workspaces!inner(id, name)")
        .eq("user_id", user.id);
      const rows = ((data ?? []) as Array<{
        role: string; workspace_id: string; workspaces: { id: string; name: string } | null;
      }>)
        .filter((r) => r.workspaces)
        .map((r) => ({ id: r.workspace_id, name: r.workspaces!.name, role: r.role }));
      setList(rows);
      setLoading(false);
    })();
  }, [user?.id]);
  return { list, loading };
}

function CountryCombobox({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Select country"}
          </span>
          <Search className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={c.name}
                  onSelect={() => { onChange(c.name); setOpen(false); }}
                >
                  <span className="mr-2">{c.flag}</span>
                  {c.name}
                  {value === c.name && <Check className="w-3.5 h-3.5 ml-auto text-accent" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn(
          "h-1.5 rounded-full transition-all",
          i < step ? "w-6 bg-accent" : i === step ? "w-6 bg-primary" : "w-4 bg-muted",
        )} />
      ))}
    </div>
  );
}

interface Draft {
  legal_name: string;
  entity_type: string;
  primary_contact_name: string;
  primary_email: string;
  primary_phone: string;
  country: string;
  state: string;
  pan_number: string;
  is_gst_registered: boolean;
  gstin: string;
  place_of_supply_state: string;
}

const EMPTY: Draft = {
  legal_name: "", entity_type: "", primary_contact_name: "",
  primary_email: "", primary_phone: "", country: "", state: "",
  pan_number: "", is_gst_registered: false, gstin: "", place_of_supply_state: "",
};

export default function StudioOnboardingWizard({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth();
  // Use the SAME active workspace id as StudioProfileOnboardingGate so the
  // wizard reads and writes the exact `entity_profiles` row the gate checks.
  // Falls back to the user's first workspace only when no active id is set.
  const { activeId: wsActiveId, workspaces: wsList, setActiveId, loading: wsLoading } = useWorkspaces();
  const { list: memberWorkspaces, loading: memberLoading } = useMyStudioWorkspaces();
  const orgId = wsActiveId ?? memberWorkspaces[0]?.id ?? null;
  // If the gate's activeId points to a workspace we can't see (edge case),
  // pin it to the first workspace the user actually belongs to.
  useEffect(() => {
    if (!wsLoading && !memberLoading && wsActiveId && memberWorkspaces.length &&
        !memberWorkspaces.some((w) => w.id === wsActiveId)) {
      setActiveId(memberWorkspaces[0].id);
    }
  }, [wsLoading, memberLoading, wsActiveId, memberWorkspaces, setActiveId]);

  const { profile, studioExt, loading, saving, canEdit, saveProfile, saveStudioExt, refresh } =
    useEntityProfile({ kind: "studio", orgId });

  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [seeded, setSeeded] = useState(false);

  // Seed the draft once, from the loaded record + logged-in user.
  useEffect(() => {
    if (seeded || !profile || !studioExt || !user) return;
    const userName =
      (user.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name
      ?? (user.user_metadata as { name?: string } | undefined)?.name
      ?? "";
    const userEmail = user.email ?? "";
    setD({
      legal_name: profile.legal_name ?? userName ?? "",
      entity_type: profile.entity_type ?? "",
      primary_contact_name: studioExt.primary_contact_name ?? userName ?? "",
      primary_email: profile.primary_email ?? userEmail ?? "",
      primary_phone: profile.primary_phone ?? "",
      country: profile.country ?? "India",
      state: profile.state ?? "",
      pan_number: profile.pan_number ?? "",
      is_gst_registered: !!profile.is_gst_registered,
      gstin: profile.gstin ?? "",
      place_of_supply_state: profile.place_of_supply_state ?? profile.state ?? "",
    });
    setSeeded(true);
  }, [profile, studioExt, user, seeded]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const isIndia = (d.country ?? "").trim().toLowerCase() === "india";

  // Per-step validity — controls Next / Complete availability.
  const stepValid = useMemo(() => {
    const s1 = !!d.legal_name.trim() && !!d.entity_type;
    const s2 =
      !!d.primary_contact_name.trim() &&
      !!d.primary_email.trim() &&
      !!d.primary_phone.trim() &&
      !!d.country.trim() &&
      !!d.state.trim();
    const panOk = validatePAN(d.pan_number).ok === true;
    const gstinOk = !d.is_gst_registered || (validateGSTIN(d.gstin).ok === true && !!d.place_of_supply_state.trim());
    const s3 = panOk && gstinOk;
    return [s1, s2, s3, s1 && s2 && s3];
  }, [d]);

  const stepLabels = ["Studio", "Contact", "Tax & Billing", "Review"];

  const handleComplete = async () => {
    if (!profile || !studioExt) return;
    if (!stepValid[3]) { toast.error("Please complete required fields."); return; }
    try {
      // Save only changed fields — reuses existing update endpoints.
      const patchP: Partial<EntityProfile> = {};
      const put = <K extends keyof EntityProfile>(k: K, v: EntityProfile[K]) => {
        if ((profile[k] ?? null) !== (v ?? null)) patchP[k] = v;
      };
      put("legal_name", d.legal_name.trim());
      put("entity_type", d.entity_type);
      put("primary_email", d.primary_email.trim());
      put("primary_phone", d.primary_phone.trim());
      put("country", d.country.trim());
      put("state", d.state.trim());
      put("pan_number", d.pan_number.trim().toUpperCase() || null);
      put("is_gst_registered", d.is_gst_registered);
      put("gstin", d.is_gst_registered ? (d.gstin.trim().toUpperCase() || null) : null);
      put("place_of_supply_state", d.is_gst_registered ? (d.place_of_supply_state.trim() || null) : (profile.place_of_supply_state ?? null));
      // Auto-mirror billing identity so downstream invoicing works without a
      // separate step — user can override later in Settings > Studio Profile.
      if (!profile.billing_legal_name) put("billing_legal_name", d.legal_name.trim());
      if (!profile.billing_email) put("billing_email", d.primary_email.trim());
      if (!profile.billing_phone) put("billing_phone", d.primary_phone.trim());
      if (!profile.billing_country) put("billing_country", d.country.trim());
      if (!profile.billing_state) put("billing_state", d.state.trim());
      if (Object.keys(patchP).length) await saveProfile(patchP);

      const patchE: Partial<StudioExt> = {};
      if ((studioExt.primary_contact_name ?? "") !== d.primary_contact_name.trim()) {
        patchE.primary_contact_name = d.primary_contact_name.trim();
      }
      if ((studioExt.primary_contact_email ?? "") !== d.primary_email.trim()) {
        patchE.primary_contact_email = d.primary_email.trim();
      }
      if ((studioExt.primary_contact_phone ?? "") !== d.primary_phone.trim()) {
        patchE.primary_contact_phone = d.primary_phone.trim();
      }
      if (Object.keys(patchE).length) await saveStudioExt(patchE);

      toast.success("Studio activated — welcome to your Production Control Center.");
      await refresh();
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (wsLoading || loading || !profile || !studioExt) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }

  if (!canEdit) {
    // If the user is admin/owner of a DIFFERENT workspace, offer to switch
    // rather than dead-ending them on the wizard.
    const adminElsewhere = memberWorkspaces.filter(
      (w) => (w.role === "owner" || w.role === "admin") && w.id !== orgId,
    );
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground p-6">
        <Card className="p-6 max-w-md text-sm space-y-4">
          <p className="text-muted-foreground">
            You need workspace owner or admin permissions to complete studio onboarding for
            <span className="text-foreground"> {wsList.find((w) => w.id === orgId)?.name ?? "this workspace"}</span>.
          </p>
          {adminElsewhere.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Switch to a workspace you administer:</div>
              {adminElsewhere.map((w) => (
                <Button key={w.id} variant="outline" size="sm" className="w-full justify-start"
                  onClick={() => setActiveId(w.id)}>
                  {w.name}
                </Button>
              ))}
            </div>
          )}
        </Card>
      </main>
    );
  }

  const progressPct = ((step + 1) / 4) * 100;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">
            One-time setup
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-semibold tracking-tight">Activate your Studio</h1>
            <p className="text-xs text-muted-foreground">
              Step {step + 1} of 4 · {stepLabels[step]}
            </p>
          </div>
          <StepDots step={step} total={4} />
        </div>
        <Progress value={progressPct} className="h-1" />

        <Card className="p-5 md:p-6 space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Studio / Legal name <span className="text-destructive">*</span></Label>
                <Input autoFocus value={d.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="e.g. Crayons Pictures LLP" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entity type <span className="text-destructive">*</span></Label>
                <Select value={d.entity_type} onValueChange={(v) => set("entity_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select entity type" /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact name <span className="text-destructive">*</span></Label>
                <Input value={d.primary_contact_name} onChange={(e) => set("primary_contact_name", e.target.value)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={d.primary_email} onChange={(e) => set("primary_email", e.target.value.trim())} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone <span className="text-destructive">*</span></Label>
                  <Input inputMode="tel" value={d.primary_phone} onChange={(e) => set("primary_phone", formatPhone(e.target.value))} placeholder="+91 9xxxxxxxxx" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Country <span className="text-destructive">*</span></Label>
                  <CountryCombobox value={d.country} onChange={(v) => { set("country", v); if (v.toLowerCase() !== "india") set("state", ""); }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State <span className="text-destructive">*</span></Label>
                  {isIndia ? (
                    <Select value={d.state} onValueChange={(v) => { set("state", v); if (!d.place_of_supply_state) set("place_of_supply_state", v); }}>
                      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {INDIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={d.state} onChange={(e) => set("state", e.target.value)} placeholder="State / Region" />
                  )}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">PAN <span className="text-destructive">*</span></Label>
                <Input value={d.pan_number} onChange={(e) => set("pan_number", formatTaxId(e.target.value))} maxLength={10} placeholder="AAAAA9999A" />
                {d.pan_number && validatePAN(d.pan_number).ok !== true && (
                  <p className="text-[11px] text-destructive">Enter a valid PAN (AAAAA9999A).</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/40 p-3">
                <div>
                  <div className="text-sm">Registered under GST</div>
                  <div className="text-xs text-muted-foreground">Turn on if this studio has a GSTIN.</div>
                </div>
                <Switch checked={d.is_gst_registered} onCheckedChange={(v) => set("is_gst_registered", v)} />
              </div>
              {d.is_gst_registered && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">GSTIN <span className="text-destructive">*</span></Label>
                    <Input value={d.gstin} onChange={(e) => set("gstin", formatTaxId(e.target.value))} maxLength={15} placeholder="22AAAAA0000A1Z5" />
                    {d.gstin && validateGSTIN(d.gstin).ok !== true && (
                      <p className="text-[11px] text-destructive">Enter a valid GSTIN.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Place of supply <span className="text-destructive">*</span></Label>
                    {isIndia ? (
                      <Select value={d.place_of_supply_state} onValueChange={(v) => set("place_of_supply_state", v)}>
                        <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                        <SelectContent>
                          {INDIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={d.place_of_supply_state} onChange={(e) => set("place_of_supply_state", e.target.value)} />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Review your details. You can edit anything later from Settings &gt; Studio Profile.
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <SummaryRow label="Legal name" value={d.legal_name} />
                <SummaryRow label="Entity type" value={ENTITY_TYPES.find(([v]) => v === d.entity_type)?.[1] ?? d.entity_type} />
                <SummaryRow label="Contact" value={d.primary_contact_name} />
                <SummaryRow label="Email" value={d.primary_email} />
                <SummaryRow label="Phone" value={d.primary_phone} />
                <SummaryRow label="Location" value={[d.state, d.country].filter(Boolean).join(", ")} />
                <SummaryRow label="PAN" value={d.pan_number} />
                <SummaryRow label="GST" value={d.is_gst_registered ? `${d.gstin} · ${d.place_of_supply_state}` : "Not registered"} />
              </dl>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={!stepValid[step]}
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={!stepValid[3] || saving}
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Activating…</> : <>Complete Setup <Check className="w-4 h-4 ml-1" /></>}
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Only the minimum required to activate your studio. Add About, Website, Services, Public Links and more anytime from Studio Profile.
        </p>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wider">{label}</dt>
      <dd className="font-medium text-right truncate">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
