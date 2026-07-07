import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Radio, RefreshCw, Save, Eye, EyeOff, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PartnerRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  licensing_models: string[] | null;
  territories: string[] | null;
  languages: string[] | null;
  submission_requirements: string | null;
  contact_email: string | null;
  organization_id: string | null;
  organization?: { id: string; published: boolean; status: string } | null;
}

/**
 * Channel Partners = organizations of kind `channel_partner`.
 * Editor drives the partner_profiles row (public-facing content) and the
 * organizations.published flag (whether the public /partners page lists it).
 */
export default function ChannelPartnersConsole() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Partial<PartnerRow>>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("partner_profiles")
      .select("*, organization:organizations!partner_profiles_organization_id_fkey(id, published, status)")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as PartnerRow[]);
  };

  useEffect(() => { load(); }, []);

  const patch = (id: string, delta: Partial<PartnerRow>) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...delta } }));

  const save = async (row: PartnerRow) => {
    const changes = draft[row.id];
    if (!changes) return;
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("partner_profiles")
      .update({
        name: changes.name ?? row.name,
        tagline: changes.tagline ?? row.tagline,
        description: changes.description ?? row.description,
        website_url: changes.website_url ?? row.website_url,
        contact_email: changes.contact_email ?? row.contact_email,
        submission_requirements: changes.submission_requirements ?? row.submission_requirements,
        is_active: changes.is_active ?? row.is_active,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Partner saved");
    setDraft((prev) => { const p = { ...prev }; delete p[row.id]; return p; });
    load();
  };

  const togglePublish = async (row: PartnerRow) => {
    if (!row.organization_id) { toast.error("Missing linked organization"); return; }
    const next = !(row.organization?.published ?? false);
    const { error } = await (supabase as any)
      .from("organizations")
      .update({ published: next, status: "active" })
      .eq("id", row.organization_id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Published on /partners" : "Unpublished");
    load();
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/10 p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-accent" />
          <h3 className="font-display text-lg font-semibold">Channel Partners</h3>
          <span className="text-xs text-muted-foreground">
            Publishes to <span className="text-accent">/partners</span>. Creator workspace will later see extended licensing detail from these same records.
          </span>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40 flex items-center gap-1.5"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="p-8 text-center text-muted-foreground">
          <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading channel partners…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No channel partners yet. Invite one from the <span className="text-accent">Invitations</span> tab.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const isOpen = expanded === row.id;
          const d = draft[row.id] ?? {};
          const isPublished = row.organization?.published ?? false;
          return (
            <div key={row.id} className="rounded-xl border border-border/40 bg-background/30">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-md bg-secondary/30 grid place-items-center overflow-hidden shrink-0">
                  {row.logo_url ? (
                    <img src={row.logo_url} alt={row.name} className="w-full h-full object-contain" />
                  ) : (
                    <Radio className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{row.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{row.tagline || row.slug}</div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    isPublished
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                      : "bg-muted/40 text-muted-foreground border-border/60",
                  )}
                >
                  {isPublished ? "Published" : "Draft"}
                </Badge>
                <button
                  onClick={() => togglePublish(row)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40 flex items-center gap-1.5"
                >
                  {isPublished ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {isPublished ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40"
                >
                  {isOpen ? "Close" : "Edit"}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-border/40 p-4 grid gap-3 md:grid-cols-2">
                  <Field label="Name">
                    <input value={d.name ?? row.name} onChange={(e) => patch(row.id, { name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Website">
                    <input value={d.website_url ?? row.website_url ?? ""} onChange={(e) => patch(row.id, { website_url: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Tagline" full>
                    <input value={d.tagline ?? row.tagline ?? ""} onChange={(e) => patch(row.id, { tagline: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Description" full>
                    <textarea rows={3} value={d.description ?? row.description ?? ""} onChange={(e) => patch(row.id, { description: e.target.value })} className={cn(inputCls, "resize-y")} />
                  </Field>
                  <Field label="Submission requirements" full>
                    <textarea rows={2} value={d.submission_requirements ?? row.submission_requirements ?? ""} onChange={(e) => patch(row.id, { submission_requirements: e.target.value })} className={cn(inputCls, "resize-y")} />
                  </Field>
                  <Field label="Contact email">
                    <input value={d.contact_email ?? row.contact_email ?? ""} onChange={(e) => patch(row.id, { contact_email: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Active">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={d.is_active ?? row.is_active} onChange={(e) => patch(row.id, { is_active: e.target.checked })} />
                      Include in public listing
                    </label>
                  </Field>
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      onClick={() => save(row)}
                      disabled={savingId === row.id}
                      className="px-4 py-2 rounded-md text-sm font-semibold bg-gradient-primary text-primary-foreground disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {savingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Licensing models, territories and content preferences are stored on each partner record and will surface in the Creator workspace once the authenticated licensing view is enabled.
      </p>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-md text-sm bg-background border border-border/60 focus:outline-none focus:border-accent";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={cn("space-y-1", full && "md:col-span-2")}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
