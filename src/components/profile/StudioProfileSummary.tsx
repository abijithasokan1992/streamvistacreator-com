/**
 * StudioProfileSummary
 * ====================
 * Read-only compact summary rendered by `MyStudioProfile` once profile
 * completeness reaches 100%. Reuses existing profile data — no new fetches,
 * no duplicate validation, no backend changes. Empty optional sections are
 * hidden so the summary always looks polished.
 */
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import {
  Building2, Phone, MapPin, Receipt, ShieldCheck, Lock, Sparkles, Link2, Pencil,
} from "lucide-react";
import type { EntityProfile, StudioExt } from "@/hooks/useEntityProfile";

type Social = { platform: string; url: string };

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "" ||
      (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium text-foreground break-words">
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  title, icon: Icon, children, hidden = false,
}: {
  title: string;
  icon: any;
  children: ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <Card className="p-4 space-y-2.5">
      <h3 className="text-sm font-semibold inline-flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent" /> {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </Card>
  );
}

function nonEmpty(...vals: Array<string | number | null | undefined>) {
  return vals.some((v) => v !== null && v !== undefined && v !== "");
}

export default function StudioProfileSummary({
  profile,
  ext,
  socials,
  canEdit,
  onEdit,
}: {
  profile: EntityProfile;
  ext: StudioExt;
  socials: Social[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const address = [
    profile.address_line1, profile.address_line2, profile.city,
    profile.state, profile.postal_code, profile.country,
  ].filter(Boolean).join(", ");

  const billingAddress = [
    profile.billing_address_line1, profile.billing_address_line2, profile.billing_city,
    profile.billing_state, profile.billing_postal_code, profile.billing_country,
  ].filter(Boolean).join(", ");

  const capabilities = (ext.facility_capabilities ?? []).concat(ext.services ?? []);
  const langs = ext.languages_served ?? [];
  const regions = ext.regions_served ?? [];
  const capsHidden = capabilities.length === 0 && langs.length === 0 && regions.length === 0;
  const linksHidden = socials.length === 0 && !profile.website;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Profile complete — showing summary. All fields are safe and verified.
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Profile
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Studio" icon={Building2}>
          <Row label="Display name" value={profile.display_name} />
          <Row label="Legal name" value={profile.legal_name} />
          <Row label="Entity type" value={profile.entity_type} />
          <Row label="Year founded" value={ext.year_founded} />
          {ext.about && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/40 mt-2">
              {ext.about}
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="Contact" icon={Phone}>
          <Row label="Primary contact" value={ext.primary_contact_name} />
          <Row label="Designation" value={ext.primary_contact_designation} />
          <Row label="Contact email" value={ext.primary_contact_email} />
          <Row label="Contact phone" value={ext.primary_contact_phone} />
          <Row label="Studio email" value={profile.primary_email} />
          <Row label="Studio phone" value={profile.primary_phone} />
          <Row label="WhatsApp" value={profile.whatsapp} />
        </SummaryCard>

        <SummaryCard
          title="Address"
          icon={MapPin}
          hidden={!address && !billingAddress}
        >
          <Row label="Registered" value={address} />
          {billingAddress && billingAddress !== address && (
            <Row label="Billing" value={billingAddress} />
          )}
        </SummaryCard>

        <SummaryCard
          title="Tax & Billing"
          icon={Receipt}
          hidden={!nonEmpty(profile.pan_number, profile.gstin, profile.tan_number,
            profile.cin_number, profile.billing_legal_name, profile.billing_email)}
        >
          <Row label="PAN" value={profile.pan_number} />
          <Row
            label="GST"
            value={
              profile.is_gst_registered
                ? profile.gstin ?? "Registered"
                : (profile.gstin ? profile.gstin : null)
            }
          />
          <Row label="Place of supply" value={profile.place_of_supply_state} />
          <Row label="TAN" value={profile.tan_number} />
          <Row label="CIN" value={profile.cin_number} />
          <Row label="Billing legal name" value={profile.billing_legal_name} />
          <Row label="Billing email" value={profile.billing_email} />
        </SummaryCard>

        <SummaryCard title="Verification" icon={ShieldCheck}>
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={profile.verification_status} />
            {profile.last_verified_at && (
              <span className="text-[11px] text-muted-foreground">
                {new Date(profile.last_verified_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {profile.verification_notes && (
            <p className="text-xs text-muted-foreground">{profile.verification_notes}</p>
          )}
        </SummaryCard>

        <SummaryCard title="Security" icon={Lock}>
          <p className="text-xs text-muted-foreground">
            Password, MFA and session controls stay in Edit Mode.
          </p>
          {canEdit && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
              Manage security →
            </Button>
          )}
        </SummaryCard>

        <SummaryCard title="Capabilities" icon={Sparkles} hidden={capsHidden}>
          {capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {capabilities.map((c, i) => (
                <Badge key={`${c}-${i}`} variant="outline" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          )}
          {(langs.length > 0 || regions.length > 0) && (
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
              {langs.length > 0 && <div>Languages: {langs.join(", ")}</div>}
              {regions.length > 0 && <div>Regions: {regions.join(", ")}</div>}
            </div>
          )}
        </SummaryCard>

        <SummaryCard title="Links" icon={Link2} hidden={linksHidden}>
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer"
               className="text-xs text-accent hover:underline break-all block">
              {profile.website}
            </a>
          )}
          {socials.map((s) => (
            <a key={`${s.platform}-${s.url}`} href={s.url} target="_blank" rel="noreferrer"
               className="text-xs text-accent hover:underline break-all block">
              <span className="text-muted-foreground mr-1.5 capitalize">{s.platform}:</span>{s.url}
            </a>
          ))}
        </SummaryCard>
      </div>
    </div>
  );
}
