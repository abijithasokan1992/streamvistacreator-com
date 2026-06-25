import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ChevronLeft, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEntityProfile, type EntityProfile, type CreatorExt } from "@/hooks/useEntityProfile";
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

const ENTITY_TYPES = [
  ["individual", "Individual"],
  ["proprietorship", "Proprietorship"],
  ["partnership", "Partnership"],
  ["llp", "LLP"],
  ["pvt_ltd", "Private Limited"],
  ["public_ltd", "Public Limited"],
  ["trust", "Trust"],
  ["other", "Other"],
] as const;

function commaJoin(arr: string[]) { return arr.join(", "); }
function commaSplit(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default function MyCreatorProfile() {
  const { user, loading: authLoading } = useAuth();
  const {
    profile, creatorExt, socials, loading, saving,
    saveProfile, saveCreatorExt, upsertSocial, removeSocial,
  } = useEntityProfile({ kind: "creator" });

  const [pForm, setPForm] = useState<Partial<EntityProfile>>({});
  const [eForm, setEForm] = useState<Partial<CreatorExt> & { _genres?: string; _languages?: string; _regions?: string }>({});

  useEffect(() => { if (profile) setPForm({}); }, [profile?.id]);
  useEffect(() => { if (creatorExt) setEForm({}); }, [creatorExt?.profile_id]);

  const merged = useMemo<EntityProfile | null>(
    () => (profile ? { ...profile, ...pForm } as EntityProfile : null),
    [profile, pForm],
  );

  const mergedExt = useMemo<CreatorExt | null>(() => {
    if (!creatorExt) return null;
    return {
      ...creatorExt,
      ...eForm,
      primary_genres: eForm._genres !== undefined ? commaSplit(eForm._genres) : creatorExt.primary_genres,
      languages: eForm._languages !== undefined ? commaSplit(eForm._languages) : creatorExt.languages,
      regions: eForm._regions !== undefined ? commaSplit(eForm._regions) : creatorExt.regions,
    } as CreatorExt;
  }, [creatorExt, eForm]);

  const dirty = Object.keys(pForm).length > 0 || Object.keys(eForm).length > 0;

  const setP = <K extends keyof EntityProfile>(k: K, v: EntityProfile[K]) =>
    setPForm((f) => ({ ...f, [k]: v }));

  const setE = (k: string, v: unknown) =>
    setEForm((f) => ({ ...f, [k]: v as never }));

  const handleSave = async () => {
    try {
      if (Object.keys(pForm).length) await saveProfile(pForm);
      if (creatorExt && Object.keys(eForm).length) {
        const extPatch: Partial<CreatorExt> = { ...eForm } as Partial<CreatorExt>;
        if (eForm._genres !== undefined) extPatch.primary_genres = commaSplit(eForm._genres);
        if (eForm._languages !== undefined) extPatch.languages = commaSplit(eForm._languages);
        if (eForm._regions !== undefined) extPatch.regions = commaSplit(eForm._regions);
        delete (extPatch as Record<string, unknown>)._genres;
        delete (extPatch as Record<string, unknown>)._languages;
        delete (extPatch as Record<string, unknown>)._regions;
        await saveCreatorExt(extPatch);
      }
      setPForm({}); setEForm({});
      toast.success("Profile saved.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReset = () => { setPForm({}); setEForm({}); };

  if (authLoading || loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!merged || !mergedExt) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Card className="p-6 max-w-md">
          <p className="text-sm">Could not load your profile. Please refresh.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
          <Link to="/dashboard/content" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <VerificationBadge status={merged.verification_status} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-24">
        <section className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary" /> My Creator Profile
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Identity, contact, tax and billing details used across StreamVista.
            </p>
          </div>
          <div className="w-56 hidden sm:block">
            <div className="text-[11px] text-muted-foreground mb-1">Profile completeness</div>
            <Progress value={merged.profile_completion_pct} className="h-2" />
            <div className="text-[11px] text-right text-muted-foreground mt-1">{merged.profile_completion_pct}%</div>
          </div>
        </section>

        <FieldGroup title="Identity" description="How you appear on StreamVista and on legal documents.">
          <div className="space-y-1.5">
            <Label className="text-xs">Display name</Label>
            <Input value={merged.display_name ?? ""} onChange={(e) => setP("display_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Legal name</Label>
            <Input value={merged.legal_name ?? ""} onChange={(e) => setP("legal_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Entity type</Label>
            <Select value={merged.entity_type ?? ""} onValueChange={(v) => setP("entity_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Professional / stage name</Label>
            <Input value={mergedExt.professional_name ?? ""} onChange={(e) => setE("professional_name", e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Short bio</Label>
            <Textarea rows={3} value={mergedExt.bio ?? ""} onChange={(e) => setE("bio", e.target.value)} />
          </div>
        </FieldGroup>

        <FieldGroup title="Contact">
          <div className="space-y-1.5">
            <Label className="text-xs">Primary email</Label>
            <Input type="email" value={merged.primary_email ?? ""} onChange={(e) => setP("primary_email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Primary phone</Label>
            <Input value={merged.primary_phone ?? ""} onChange={(e) => setP("primary_phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">WhatsApp</Label>
            <Input value={merged.whatsapp ?? ""} onChange={(e) => setP("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Website</Label>
            <Input value={merged.website ?? ""} onChange={(e) => setP("website", e.target.value)} placeholder="https://…" />
          </div>
        </FieldGroup>

        <FieldGroup title="Address">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Address line 1</Label>
            <Input value={merged.address_line1 ?? ""} onChange={(e) => setP("address_line1", e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Address line 2</Label>
            <Input value={merged.address_line2 ?? ""} onChange={(e) => setP("address_line2", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <Input value={merged.city ?? ""} onChange={(e) => setP("city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">State</Label>
            <Input value={merged.state ?? ""} onChange={(e) => setP("state", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Postal code</Label>
            <Input value={merged.postal_code ?? ""} onChange={(e) => setP("postal_code", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Country</Label>
            <Input value={merged.country ?? ""} onChange={(e) => setP("country", e.target.value)} />
          </div>
        </FieldGroup>

        <FieldGroup title="Tax identity" description="PAN, GST, TAN and CIN as applicable.">
          <div className="space-y-1.5">
            <Label className="text-xs">PAN</Label>
            <Input value={merged.pan_number ?? ""} onChange={(e) => setP("pan_number", e.target.value.toUpperCase())} maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GSTIN</Label>
            <Input value={merged.gstin ?? ""} onChange={(e) => setP("gstin", e.target.value.toUpperCase())} maxLength={15} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">TAN</Label>
            <Input value={merged.tan_number ?? ""} onChange={(e) => setP("tan_number", e.target.value.toUpperCase())} maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CIN</Label>
            <Input value={merged.cin_number ?? ""} onChange={(e) => setP("cin_number", e.target.value.toUpperCase())} maxLength={21} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/40 p-3 md:col-span-2">
            <div>
              <div className="text-sm">Registered under GST</div>
              <div className="text-xs text-muted-foreground">Toggle on if you have a valid GSTIN.</div>
            </div>
            <Switch checked={!!merged.is_gst_registered} onCheckedChange={(v) => setP("is_gst_registered", v)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Place of supply (state)</Label>
            <Input value={merged.place_of_supply_state ?? ""} onChange={(e) => setP("place_of_supply_state", e.target.value)} />
          </div>
        </FieldGroup>

        <FieldGroup title="Billing identity" description="Used on invoices issued by StreamVista.">
          <div className="space-y-1.5">
            <Label className="text-xs">Billing legal name</Label>
            <Input value={merged.billing_legal_name ?? ""} onChange={(e) => setP("billing_legal_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billing email</Label>
            <Input type="email" value={merged.billing_email ?? ""} onChange={(e) => setP("billing_email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billing phone</Label>
            <Input value={merged.billing_phone ?? ""} onChange={(e) => setP("billing_phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billing country</Label>
            <Input value={merged.billing_country ?? ""} onChange={(e) => setP("billing_country", e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Billing address line 1</Label>
            <Input value={merged.billing_address_line1 ?? ""} onChange={(e) => setP("billing_address_line1", e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Billing address line 2</Label>
            <Input value={merged.billing_address_line2 ?? ""} onChange={(e) => setP("billing_address_line2", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <Input value={merged.billing_city ?? ""} onChange={(e) => setP("billing_city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">State</Label>
            <Input value={merged.billing_state ?? ""} onChange={(e) => setP("billing_state", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Postal code</Label>
            <Input value={merged.billing_postal_code ?? ""} onChange={(e) => setP("billing_postal_code", e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Billing notes (optional)</Label>
            <Textarea rows={2} value={merged.billing_notes ?? ""} onChange={(e) => setP("billing_notes", e.target.value)} />
          </div>
        </FieldGroup>

        <FieldGroup title="Creator details" description="Helps us match your titles with the right buyers.">
          <div className="space-y-1.5">
            <Label className="text-xs">Banner / company name</Label>
            <Input value={mergedExt.banner_company_name ?? ""} onChange={(e) => setE("banner_company_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Years active</Label>
            <Input type="number" value={mergedExt.years_active ?? ""} onChange={(e) => setE("years_active", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Primary genres (comma-separated)</Label>
            <Input
              value={eForm._genres ?? commaJoin(mergedExt.primary_genres)}
              onChange={(e) => setE("_genres", e.target.value)}
              placeholder="e.g. drama, thriller, documentary"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Languages (comma-separated)</Label>
            <Input
              value={eForm._languages ?? commaJoin(mergedExt.languages)}
              onChange={(e) => setE("_languages", e.target.value)}
              placeholder="e.g. Hindi, Tamil, English"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Regions (comma-separated)</Label>
            <Input
              value={eForm._regions ?? commaJoin(mergedExt.regions)}
              onChange={(e) => setE("_regions", e.target.value)}
              placeholder="e.g. India, GCC, North America"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">IMDb profile URL</Label>
            <Input value={mergedExt.imdb_url ?? ""} onChange={(e) => setE("imdb_url", e.target.value)} placeholder="https://www.imdb.com/name/…" />
          </div>
        </FieldGroup>

        <FieldGroup title="Public links" description="Websites, socials, OTT/TV pages, channels.">
          <div className="md:col-span-2">
            <SocialLinksGrid
              socials={socials}
              canEdit={true}
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
      </div>

      <ProfileSaveBar dirty={dirty} saving={saving} onSave={handleSave} onReset={handleReset} />
    </main>
  );
}
