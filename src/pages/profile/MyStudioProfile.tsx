import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ChevronLeft, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEntityProfile, type EntityProfile, type StudioExt } from "@/hooks/useEntityProfile";
import { FieldGroup } from "@/components/profile/FieldGroup";
import { SocialLinksGrid } from "@/components/profile/SocialLinksGrid";
import { AccountSecurityCard } from "@/components/profile/AccountSecurityCard";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { ProfileSaveBar } from "@/components/profile/ProfileSaveBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  formatTaxId, formatDigits, formatPhone,
  validatePAN, validateGSTIN, validateTAN, validateCIN,
  validateEmail, validatePhone, validatePincode,
  validateGstRegistration, type ValidationResult,
} from "@/lib/identityValidators";

function FieldError({ result }: { result: ValidationResult }) {
  if (result.ok === true) return null;
  return <p className="text-[11px] text-destructive mt-1">{result.message}</p>;
}

const ENTITY_TYPES = [
  ["proprietorship", "Proprietorship"],
  ["partnership", "Partnership"],
  ["llp", "LLP"],
  ["pvt_ltd", "Private Limited"],
  ["public_ltd", "Public Limited"],
  ["trust", "Trust"],
  ["other", "Other"],
] as const;

type Workspace = { id: string; name: string; role: string };

function commaJoin(arr: string[] | null | undefined) { return (arr ?? []).join(", "); }
function commaSplit(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

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
        role: string;
        workspace_id: string;
        workspaces: { id: string; name: string } | null;
      }>)
        .filter((r) => r.workspaces)
        .map((r) => ({ id: r.workspace_id, name: r.workspaces!.name, role: r.role }));
      setList(rows);
      setLoading(false);
    })();
  }, [user?.id]);
  return { list, loading };
}

export default function MyStudioProfile({
  onboarding = false,
  onDone,
}: {
  onboarding?: boolean;
  onDone?: () => void;
} = {}) {
  const { user, loading: authLoading } = useAuth();
  const { list: workspaces, loading: wsLoading } = useMyStudioWorkspaces();
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId && workspaces.length) setOrgId(workspaces[0].id);
  }, [workspaces, orgId]);

  const {
    profile, studioExt, socials, loading, saving, canEdit,
    saveProfile, saveStudioExt, upsertSocial, removeSocial, refresh,
  } = useEntityProfile({ kind: "studio", orgId });

  const [pForm, setPForm] = useState<Partial<EntityProfile>>({});
  const [eForm, setEForm] = useState<
    Partial<StudioExt> & {
      _services?: string;
      _capabilities?: string;
      _languages?: string;
      _regions?: string;
    }
  >({});

  useEffect(() => { setPForm({}); }, [profile?.id]);
  useEffect(() => { setEForm({}); }, [studioExt?.profile_id]);

  // Auto-fill defaults from the logged-in user so DITs don't retype known
  // values (legal name / emails). Only populates fields that are still empty
  // on the loaded record — never overwrites saved data.
  useEffect(() => {
    if (!profile || !studioExt || !user) return;
    const userName =
      (user.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name
      ?? (user.user_metadata as { name?: string } | undefined)?.name
      ?? "";
    const userEmail = user.email ?? "";
    const patchP: Partial<EntityProfile> = {};
    const patchE: Partial<StudioExt> = {};
    if (!profile.legal_name && userName) patchP.legal_name = userName;
    if (!profile.billing_legal_name && userName) patchP.billing_legal_name = userName;
    if (!profile.primary_email && userEmail) patchP.primary_email = userEmail;
    if (!profile.billing_email && userEmail) patchP.billing_email = userEmail;
    if (!studioExt.primary_contact_name && userName) patchE.primary_contact_name = userName;
    if (!studioExt.primary_contact_email && userEmail) patchE.primary_contact_email = userEmail;
    if (Object.keys(patchP).length) setPForm((f) => ({ ...patchP, ...f }));
    if (Object.keys(patchE).length) setEForm((f) => ({ ...patchE, ...f }));
    // Run only when the loaded profile/user identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, studioExt?.profile_id, user?.id]);


  const merged = useMemo<EntityProfile | null>(
    () => (profile ? { ...profile, ...pForm } as EntityProfile : null),
    [profile, pForm],
  );

  const mergedExt = useMemo<StudioExt | null>(() => {
    if (!studioExt) return null;
    return {
      ...studioExt,
      ...eForm,
      services: eForm._services !== undefined ? commaSplit(eForm._services) : studioExt.services,
      facility_capabilities: eForm._capabilities !== undefined ? commaSplit(eForm._capabilities) : studioExt.facility_capabilities,
      languages_served: eForm._languages !== undefined ? commaSplit(eForm._languages) : studioExt.languages_served,
      regions_served: eForm._regions !== undefined ? commaSplit(eForm._regions) : studioExt.regions_served,
    } as StudioExt;
  }, [studioExt, eForm]);

  const dirty = Object.keys(pForm).length > 0 || Object.keys(eForm).length > 0;

  // Entity-type dependencies: proprietorships legally can't have a CIN, so we
  // hide the field entirely and skip its validator when this entity type is
  // selected. Any previously-entered CIN is dropped on save.
  const isProprietorship = (merged?.entity_type ?? "").toLowerCase() === "proprietorship";

  // Real-time validation results for tax + billing identity inputs.
  const errors = useMemo(() => {
    if (!merged || !mergedExt) {
      return {} as Record<string, ValidationResult>;
    }
    // Place of supply is mandatory when GST registration is on (invoice legally
    // needs a state code even if GSTIN itself validates independently).
    const placeOfSupply: ValidationResult = merged.is_gst_registered
      && !(merged.place_of_supply_state ?? "").trim()
      ? { ok: false, message: "Place of Supply is required when GST is registered." }
      : { ok: true };
    return {
      pan: validatePAN(merged.pan_number),
      gstin: validateGSTIN(merged.gstin),
      gstReg: validateGstRegistration(merged.is_gst_registered, merged.gstin),
      placeOfSupply,
      tan: validateTAN(merged.tan_number),
      cin: isProprietorship ? { ok: true } as ValidationResult : validateCIN(merged.cin_number),
      pincode: validatePincode(merged.postal_code),
      billingPincode: validatePincode(merged.billing_postal_code),
      billingEmail: validateEmail(merged.billing_email),
      billingPhone: validatePhone(merged.billing_phone),
      studioEmail: validateEmail(merged.primary_email),
      studioPhone: validatePhone(merged.primary_phone),
      whatsapp: validatePhone(merged.whatsapp),
      contactEmail: validateEmail(mergedExt.primary_contact_email),
      contactPhone: validatePhone(mergedExt.primary_contact_phone),
    } satisfies Record<string, ValidationResult>;
  }, [merged, mergedExt, isProprietorship]);

  const firstError = Object.values(errors).find((e) => e && e.ok === false);
  const invalidMessage = firstError && firstError.ok === false
    ? firstError.message
    : null;


  const setP = <K extends keyof EntityProfile>(k: K, v: EntityProfile[K]) =>
    canEdit && setPForm((f) => ({ ...f, [k]: v }));

  const setE = (k: string, v: unknown) =>
    canEdit && setEForm((f) => ({ ...f, [k]: v as never }));

  const handleSave = async () => {
    if (invalidMessage) {
      toast.error(invalidMessage);
      return;
    }
    try {
      const profilePatch: Partial<EntityProfile> = { ...pForm };
      // Drop CIN when entity type doesn't support it, so we don't persist stale
      // corporate numbers on a proprietorship record.
      if (isProprietorship) profilePatch.cin_number = null as unknown as EntityProfile["cin_number"];
      if (Object.keys(profilePatch).length) await saveProfile(profilePatch);
      if (studioExt && Object.keys(eForm).length) {
        const extPatch: Partial<StudioExt> = { ...eForm } as Partial<StudioExt>;
        if (eForm._services !== undefined) extPatch.services = commaSplit(eForm._services);
        if (eForm._capabilities !== undefined) extPatch.facility_capabilities = commaSplit(eForm._capabilities);
        if (eForm._languages !== undefined) extPatch.languages_served = commaSplit(eForm._languages);
        if (eForm._regions !== undefined) extPatch.regions_served = commaSplit(eForm._regions);
        delete (extPatch as Record<string, unknown>)._services;
        delete (extPatch as Record<string, unknown>)._capabilities;
        delete (extPatch as Record<string, unknown>)._languages;
        delete (extPatch as Record<string, unknown>)._regions;
        await saveStudioExt(extPatch);
      }
      setPForm({}); setEForm({});
      toast.success(onboarding ? "Profile complete — welcome to your Production Control Center." : "Studio profile saved.");
      // Ensure downstream reads (verification badge, completeness %) reflect
      // the freshly-saved state before the parent onboarding gate re-evaluates.
      await refresh();
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReset = () => { setPForm({}); setEForm({}); };


  if (authLoading || wsLoading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (!workspaces.length) {
    return (
      <main className="min-h-dvh bg-background text-foreground">
        <header className="border-b border-border/40">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
            <Link to="/dashboard/studio" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to dashboard
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-16">
          <Card className="p-8 text-center">
            <Building2 className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <h1 className="font-semibold mt-3">No studio workspace yet</h1>
            <p className="text-sm text-muted-foreground mt-2">
              You aren't a member of any studio workspace. Once your StreamVista team adds you to a studio, its profile will appear here.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
          {onboarding ? (
            <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">
              One-time setup
            </span>
          ) : (
            <Link to="/dashboard/studio" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to dashboard
            </Link>
          )}
          <div className="flex items-center gap-3">
            {merged && <VerificationBadge status={merged.verification_status} />}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-24">
        {onboarding && (
          <Card className="p-4 border-accent/40 bg-accent/5">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" /> Complete your Studio Profile to continue
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              We need your studio identity, tax and billing details before you can access the Production Control Center. This one-time setup unlocks Production, Upload, Storage, and Activity.
            </p>
          </Card>
        )}
        <section className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> My Studio Profile
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Studio identity, contact, tax and billing details used across StreamVista.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {workspaces.length > 1 && (
              <div className="w-64">
                <Label className="text-[11px] text-muted-foreground">Studio workspace</Label>
                <Select value={orgId ?? ""} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name} · {w.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {merged && (
              <div className="w-56 hidden sm:block">
                <div className="text-[11px] text-muted-foreground mb-1">Profile completeness</div>
                <Progress value={merged.profile_completion_pct} className="h-2" />
                <div className="text-[11px] text-right text-muted-foreground mt-1">{merged.profile_completion_pct}%</div>
              </div>
            )}
          </div>
        </section>

        {loading || !merged || !mergedExt ? (
          <Card className="p-6"><Loader2 className="w-4 h-4 animate-spin text-accent" /></Card>
        ) : (
          <>
            {!canEdit && (
              <Card className="p-3 text-xs text-muted-foreground border-dashed">
                You can view this studio profile but only workspace owners/admins can edit it.
              </Card>
            )}

            <FieldGroup title="Identity" description="How this studio appears on StreamVista and on legal documents.">
              <div className="space-y-1.5">
                <Label className="text-xs">Display name</Label>
                <Input disabled={!canEdit} value={merged.display_name ?? ""} onChange={(e) => setP("display_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Legal name</Label>
                <Input disabled={!canEdit} value={merged.legal_name ?? ""} onChange={(e) => setP("legal_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entity type</Label>
                <Select disabled={!canEdit} value={merged.entity_type ?? ""} onValueChange={(v) => setP("entity_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Year founded</Label>
                <Input disabled={!canEdit} type="number" value={mergedExt.year_founded ?? ""} onChange={(e) => setE("year_founded", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">About the studio</Label>
                <Textarea disabled={!canEdit} rows={3} value={mergedExt.about ?? ""} onChange={(e) => setE("about", e.target.value)} />
              </div>
            </FieldGroup>

            <FieldGroup title="Studio contact" description="Primary point of contact for production partners.">
              <div className="space-y-1.5">
                <Label className="text-xs">Primary contact name</Label>
                <Input disabled={!canEdit} value={mergedExt.primary_contact_name ?? ""} onChange={(e) => setE("primary_contact_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Designation</Label>
                <Input disabled={!canEdit} value={mergedExt.primary_contact_designation ?? ""} onChange={(e) => setE("primary_contact_designation", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact email</Label>
                <Input disabled={!canEdit} type="email" inputMode="email" autoComplete="email" maxLength={255}
                  value={mergedExt.primary_contact_email ?? ""}
                  onChange={(e) => setE("primary_contact_email", e.target.value.trim())} />
                <FieldError result={errors.contactEmail} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact phone</Label>
                <Input disabled={!canEdit} inputMode="tel" autoComplete="tel" maxLength={20}
                  value={mergedExt.primary_contact_phone ?? ""}
                  onChange={(e) => setE("primary_contact_phone", formatPhone(e.target.value))} />
                <FieldError result={errors.contactPhone} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Studio email</Label>
                <Input disabled={!canEdit} type="email" inputMode="email" maxLength={255}
                  value={merged.primary_email ?? ""}
                  onChange={(e) => setP("primary_email", e.target.value.trim())} />
                <FieldError result={errors.studioEmail} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Studio phone</Label>
                <Input disabled={!canEdit} inputMode="tel" maxLength={20}
                  value={merged.primary_phone ?? ""}
                  onChange={(e) => setP("primary_phone", formatPhone(e.target.value))} />
                <FieldError result={errors.studioPhone} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input disabled={!canEdit} inputMode="tel" maxLength={20}
                  value={merged.whatsapp ?? ""}
                  onChange={(e) => setP("whatsapp", formatPhone(e.target.value))} />
                <FieldError result={errors.whatsapp} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Website</Label>
                <Input disabled={!canEdit} value={merged.website ?? ""} onChange={(e) => setP("website", e.target.value)} placeholder="https://…" />
              </div>
            </FieldGroup>

            <FieldGroup title="Registered address">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Address line 1</Label>
                <Input disabled={!canEdit} value={merged.address_line1 ?? ""} onChange={(e) => setP("address_line1", e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Address line 2</Label>
                <Input disabled={!canEdit} value={merged.address_line2 ?? ""} onChange={(e) => setP("address_line2", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input disabled={!canEdit} value={merged.city ?? ""} onChange={(e) => setP("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Input disabled={!canEdit} value={merged.state ?? ""} onChange={(e) => setP("state", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Postal code</Label>
                <Input disabled={!canEdit} inputMode="numeric" maxLength={6}
                  value={merged.postal_code ?? ""}
                  onChange={(e) => setP("postal_code", formatDigits(e.target.value, 6))} />
                <FieldError result={errors.pincode} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Input disabled={!canEdit} value={merged.country ?? ""} onChange={(e) => setP("country", e.target.value)} />
              </div>
            </FieldGroup>

            <FieldGroup title="Tax identity" description="PAN, GST, TAN and CIN as applicable.">
              <div className="space-y-1.5">
                <Label className="text-xs">PAN</Label>
                <Input disabled={!canEdit} value={merged.pan_number ?? ""}
                  onChange={(e) => setP("pan_number", formatTaxId(e.target.value))}
                  maxLength={10} placeholder="AAAAA9999A" autoCapitalize="characters" />
                <FieldError result={errors.pan} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  GSTIN{merged.is_gst_registered && <span className="text-destructive"> *</span>}
                </Label>
                <Input disabled={!canEdit} value={merged.gstin ?? ""}
                  onChange={(e) => setP("gstin", formatTaxId(e.target.value))}
                  maxLength={15} placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />
                <FieldError result={errors.gstin} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">TAN</Label>
                <Input disabled={!canEdit} value={merged.tan_number ?? ""}
                  onChange={(e) => setP("tan_number", formatTaxId(e.target.value))}
                  maxLength={10} placeholder="AAAA99999A" autoCapitalize="characters" />
                <FieldError result={errors.tan} />
              </div>
              {/* CIN — hidden for Proprietorship (legally not issued). */}
              {!isProprietorship && (
                <div className="space-y-1.5">
                  <Label className="text-xs">CIN</Label>
                  <Input disabled={!canEdit} value={merged.cin_number ?? ""}
                    onChange={(e) => setP("cin_number", formatTaxId(e.target.value))}
                    maxLength={21} placeholder="U12345MH2020PTC123456" autoCapitalize="characters" />
                  <FieldError result={errors.cin} />
                </div>
              )}
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between rounded-md border border-border/40 p-3">
                  <div>
                    <div className="text-sm">Registered under GST</div>
                    <div className="text-xs text-muted-foreground">Toggle on if this studio has a valid GSTIN.</div>
                  </div>
                  <Switch disabled={!canEdit} checked={!!merged.is_gst_registered} onCheckedChange={(v) => setP("is_gst_registered", v)} />
                </div>
                <FieldError result={errors.gstReg} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Place of supply (state){merged.is_gst_registered && <span className="text-destructive"> *</span>}
                </Label>
                <Input disabled={!canEdit} value={merged.place_of_supply_state ?? ""}
                  onChange={(e) => setP("place_of_supply_state", e.target.value)}
                  placeholder={merged.is_gst_registered ? "Required when GST is on" : "Optional"} />
                <FieldError result={errors.placeOfSupply} />
              </div>
            </FieldGroup>

            <FieldGroup title="Billing identity" description="Used on invoices issued to and by this studio.">
              <div className="space-y-1.5">
                <Label className="text-xs">Billing legal name</Label>
                <Input disabled={!canEdit} value={merged.billing_legal_name ?? ""} onChange={(e) => setP("billing_legal_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Billing email</Label>
                <Input disabled={!canEdit} type="email" inputMode="email" maxLength={255}
                  value={merged.billing_email ?? ""}
                  onChange={(e) => setP("billing_email", e.target.value.trim())} />
                <FieldError result={errors.billingEmail} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Billing phone</Label>
                <Input disabled={!canEdit} inputMode="tel" maxLength={20}
                  value={merged.billing_phone ?? ""}
                  onChange={(e) => setP("billing_phone", formatPhone(e.target.value))} />
                <FieldError result={errors.billingPhone} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Billing country</Label>
                <Input disabled={!canEdit} value={merged.billing_country ?? ""} onChange={(e) => setP("billing_country", e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Billing address line 1</Label>
                <Input disabled={!canEdit} value={merged.billing_address_line1 ?? ""} onChange={(e) => setP("billing_address_line1", e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Billing address line 2</Label>
                <Input disabled={!canEdit} value={merged.billing_address_line2 ?? ""} onChange={(e) => setP("billing_address_line2", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input disabled={!canEdit} value={merged.billing_city ?? ""} onChange={(e) => setP("billing_city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Input disabled={!canEdit} value={merged.billing_state ?? ""} onChange={(e) => setP("billing_state", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Postal code</Label>
                <Input disabled={!canEdit} inputMode="numeric" maxLength={6}
                  value={merged.billing_postal_code ?? ""}
                  onChange={(e) => setP("billing_postal_code", formatDigits(e.target.value, 6))} />
                <FieldError result={errors.billingPincode} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Billing notes (optional)</Label>
                <Textarea disabled={!canEdit} rows={2} value={merged.billing_notes ?? ""} onChange={(e) => setP("billing_notes", e.target.value)} />
              </div>
            </FieldGroup>

            <FieldGroup title="Studio capabilities" description="Helps creators and buyers find the right studio.">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Services offered (comma-separated)</Label>
                <Input
                  disabled={!canEdit}
                  value={eForm._services ?? commaJoin(mergedExt.services)}
                  onChange={(e) => setE("_services", e.target.value)}
                  placeholder="e.g. post-production, VFX, DI, sound mix"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Facility capabilities (comma-separated)</Label>
                <Input
                  disabled={!canEdit}
                  value={eForm._capabilities ?? commaJoin(mergedExt.facility_capabilities)}
                  onChange={(e) => setE("_capabilities", e.target.value)}
                  placeholder="e.g. 4K DI, Dolby Atmos, RED, ARRI"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Languages served (comma-separated)</Label>
                <Input
                  disabled={!canEdit}
                  value={eForm._languages ?? commaJoin(mergedExt.languages_served)}
                  onChange={(e) => setE("_languages", e.target.value)}
                  placeholder="e.g. Hindi, Tamil, English"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Regions served (comma-separated)</Label>
                <Input
                  disabled={!canEdit}
                  value={eForm._regions ?? commaJoin(mergedExt.regions_served)}
                  onChange={(e) => setE("_regions", e.target.value)}
                  placeholder="e.g. India, GCC, North America"
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Public links" description="Studio website, showreels, IMDb, social profiles.">
              <div className="md:col-span-2">
                <SocialLinksGrid
                  socials={socials}
                  canEdit={canEdit}
                  onUpsert={upsertSocial}
                  onRemove={removeSocial}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Verification" description="Once you save your tax & billing details our team will verify them.">
              <div className="md:col-span-2 flex items-center justify-between rounded-md border border-border/40 p-3">
                <div className="space-y-1">
                  <VerificationBadge status={merged.verification_status} />
                  {merged.verification_notes && (
                    <p className="text-xs text-muted-foreground">{merged.verification_notes}</p>
                  )}
                  {merged.last_verified_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Last verified: {new Date(merged.last_verified_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </FieldGroup>

            <AccountSecurityCard />
          </>
        )}
      </div>

      <ProfileSaveBar
        dirty={dirty && canEdit}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        disabled={!!invalidMessage}
        invalidMessage={invalidMessage}
      />
    </main>
  );
}
