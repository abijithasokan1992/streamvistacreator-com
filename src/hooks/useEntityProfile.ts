import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type EntityKind = "creator" | "studio" | "buyer";

export type EntityProfile = {
  id: string;
  kind: EntityKind;
  user_id: string | null;
  org_id: string | null;

  legal_name: string | null;
  display_name: string | null;
  entity_type: string | null;
  avatar_url: string | null;

  primary_email: string | null;
  primary_phone: string | null;
  whatsapp: string | null;
  website: string | null;

  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;

  pan_number: string | null;
  gstin: string | null;
  tan_number: string | null;
  cin_number: string | null;
  is_gst_registered: boolean;
  place_of_supply_state: string | null;

  billing_legal_name: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  billing_notes: string | null;

  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verification_notes: string | null;
  last_verified_at: string | null;
  profile_completion_pct: number;

  created_at: string;
  updated_at: string;
};

export type CreatorExt = {
  profile_id: string;
  professional_name: string | null;
  bio: string | null;
  primary_genres: string[];
  languages: string[];
  regions: string[];
  years_active: number | null;
  banner_company_name: string | null;
  imdb_url: string | null;
};

export type StudioExt = {
  profile_id: string;
  about: string | null;
  services: string[];
  facility_capabilities: string[];
  languages_served: string[];
  regions_served: string[];
  primary_contact_name: string | null;
  primary_contact_designation: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  year_founded: number | null;
};

export type SocialLink = {
  id: string;
  profile_id: string;
  platform: string;
  label: string | null;
  url: string;
  sort_order: number;
};

type Args = { kind: EntityKind; userId?: string | null; orgId?: string | null };

export function useEntityProfile({ kind, userId, orgId }: Args) {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<EntityProfile | null>(null);
  const [creatorExt, setCreatorExt] = useState<CreatorExt | null>(null);
  const [studioExt, setStudioExt] = useState<StudioExt | null>(null);
  const [socials, setSocials] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const effUser = userId ?? (kind === "creator" ? user?.id ?? null : null);
  const effOrg = orgId ?? null;
  const isAdmin = role === "admin" || role === "super_admin";
  const isOwner =
    (kind === "creator" && !!effUser && effUser === user?.id) || isAdmin;

  const load = useCallback(async () => {
    if (!user) return;
    if (kind !== "creator" && !effOrg) {
      setProfile(null);
      setStudioExt(null);
      setSocials([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase.from("entity_profiles").select("*").eq("kind", kind);
    if (kind === "creator") query = query.eq("user_id", effUser!);
    else query = query.eq("org_id", effOrg!);

    const { data: existing } = await query.maybeSingle();

    let row = existing as EntityProfile | null;

    // Determine edit capability for this org (studio/buyer)
    let editable = isAdmin;
    if (kind !== "creator" && effOrg) {
      const { data: wm } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", effOrg)
        .eq("user_id", user.id)
        .maybeSingle();
      const r = (wm as { role?: string } | null)?.role ?? null;
      editable = editable || r === "owner" || r === "admin";
    } else if (kind === "creator") {
      editable = effUser === user.id || isAdmin;
    }
    setCanEdit(editable);

    if (!row && kind === "creator" && effUser === user.id) {
      const { data: created, error } = await supabase
        .from("entity_profiles")
        .insert({
          kind: "creator",
          user_id: user.id,
          primary_email: user.email,
          display_name: user.email?.split("@")[0] ?? null,
        })
        .select("*")
        .single();
      if (!error) row = created as EntityProfile;
    } else if (!row && kind !== "creator" && effOrg && editable) {
      // Seed display_name from workspace name when possible
      const { data: ws } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", effOrg)
        .maybeSingle();
      const { data: created, error } = await supabase
        .from("entity_profiles")
        .insert({
          kind,
          org_id: effOrg,
          display_name: (ws as { name?: string } | null)?.name ?? null,
        })
        .select("*")
        .single();
      if (!error) row = created as EntityProfile;
    }

    setProfile(row);

    if (row && kind === "creator") {
      const { data: ext } = await supabase
        .from("entity_profile_creator_ext")
        .select("*")
        .eq("profile_id", row.id)
        .maybeSingle();
      if (!ext) {
        const { data: createdExt } = await supabase
          .from("entity_profile_creator_ext")
          .insert({ profile_id: row.id })
          .select("*")
          .single();
        setCreatorExt(createdExt as CreatorExt);
      } else {
        setCreatorExt(ext as CreatorExt);
      }
    }

    if (row && kind === "studio") {
      const { data: ext } = await supabase
        .from("entity_profile_studio_ext")
        .select("*")
        .eq("profile_id", row.id)
        .maybeSingle();
      if (!ext && editable) {
        const { data: createdExt } = await supabase
          .from("entity_profile_studio_ext")
          .insert({ profile_id: row.id })
          .select("*")
          .single();
        setStudioExt(createdExt as StudioExt);
      } else {
        setStudioExt((ext ?? null) as StudioExt | null);
      }
    }

    if (row) {
      const { data: links } = await supabase
        .from("entity_profile_socials")
        .select("*")
        .eq("profile_id", row.id)
        .order("sort_order", { ascending: true });
      setSocials((links ?? []) as SocialLink[]);
    }

    setLoading(false);
  }, [user?.id, kind, effUser, effOrg, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (patch: Partial<EntityProfile>) => {
    if (!profile) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("entity_profiles")
      .update(patch)
      .eq("id", profile.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) throw error;
    setProfile(data as EntityProfile);
    return data as EntityProfile;
  };

  const saveCreatorExt = async (patch: Partial<CreatorExt>) => {
    if (!profile || !creatorExt) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("entity_profile_creator_ext")
      .update(patch)
      .eq("profile_id", profile.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) throw error;
    setCreatorExt(data as CreatorExt);
    return data as CreatorExt;
  };

  const saveStudioExt = async (patch: Partial<StudioExt>) => {
    if (!profile || !studioExt) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("entity_profile_studio_ext")
      .update(patch)
      .eq("profile_id", profile.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) throw error;
    setStudioExt(data as StudioExt);
    return data as StudioExt;
  };

  const upsertSocial = async (link: Partial<SocialLink> & { platform: string; url: string }) => {
    if (!profile) return;
    if (link.id) {
      const { data } = await supabase
        .from("entity_profile_socials")
        .update({ platform: link.platform, label: link.label ?? null, url: link.url, sort_order: link.sort_order ?? 0 })
        .eq("id", link.id)
        .select("*")
        .single();
      if (data) setSocials((s) => s.map((x) => (x.id === data.id ? (data as SocialLink) : x)));
    } else {
      const { data } = await supabase
        .from("entity_profile_socials")
        .insert({
          profile_id: profile.id,
          platform: link.platform,
          label: link.label ?? null,
          url: link.url,
          sort_order: link.sort_order ?? socials.length,
        })
        .select("*")
        .single();
      if (data) setSocials((s) => [...s, data as SocialLink]);
    }
  };

  const removeSocial = async (id: string) => {
    await supabase.from("entity_profile_socials").delete().eq("id", id);
    setSocials((s) => s.filter((x) => x.id !== id));
  };

  return {
    profile,
    creatorExt,
    studioExt,
    socials,
    loading,
    saving,
    isOwner,
    isAdmin,
    canEdit,
    refresh: load,
    saveProfile,
    saveCreatorExt,
    saveStudioExt,
    upsertSocial,
    removeSocial,
  };
}
