import { useEffect, useMemo, useState } from "react";
import { Loader2, Network, RefreshCw, Cable, FileJson, KeyRound, Mail, ScrollText, Sliders, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  listPartners,
  type DistributionPartner,
  type DistributionDelivery,
  type DistributionDeliveryLog,
} from "@/lib/distribution/distributionApi";

/**
 * Partner Network Hub — Admin extension over the existing distribution schema.
 *
 * Reuses:
 *   • distribution_partners            (Directory + Delivery Profiles + Connector Settings + API Credentials + Contacts)
 *   • distribution_metadata_mappings   (Metadata Templates)
 *   • distribution_deliveries          (Delivery History)
 *   • distribution_delivery_logs       (Delivery History detail)
 *   • partner_profiles                 (extended marketing/contact info)
 *
 * Read-only surface — no new tables, no duplicate CRUD. Editing of partner rows
 * continues to happen through the existing admin flows.
 */

type MetadataMapping = {
  id: string;
  partner_id: string;
  target_field: string;
  source_field: string | null;
  transform: string | null;
  is_required: boolean;
  default_value: string | null;
};

type PartnerContactRow = {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  extended_email: string | null;
  extended_slug: string | null;
};

const cfg = (p: DistributionPartner, key: string): string => {
  const c = (p.config ?? {}) as Record<string, unknown>;
  const v = c[key];
  return v == null ? "" : String(v);
};

const secretPreview = (v: string) => {
  if (!v) return "—";
  if (v.length <= 4) return "•".repeat(v.length);
  return `${v.slice(0, 2)}••••${v.slice(-2)}`;
};

export default function PartnerNetworkHub() {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<DistributionPartner[]>([]);
  const [mappings, setMappings] = useState<MetadataMapping[]>([]);
  const [contacts, setContacts] = useState<PartnerContactRow[]>([]);
  const [deliveries, setDeliveries] = useState<DistributionDelivery[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DistributionDeliveryLog[]>([]);

  const reload = async () => {
    setLoading(true);
    const [p, m, ext, d, logs] = await Promise.all([
      listPartners(),
      (supabase as any)
        .from("distribution_metadata_mappings")
        .select("id,partner_id,target_field,source_field,transform,is_required,default_value")
        .order("target_field", { ascending: true }),
      (supabase as any)
        .from("partner_profiles")
        .select("slug,contact_email,name"),
      (supabase as any)
        .from("distribution_deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      (supabase as any)
        .from("distribution_delivery_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setPartners(p);
    setMappings((m.data ?? []) as MetadataMapping[]);
    const extBySlug = new Map<string, { email: string | null; name: string }>();
    ((ext.data ?? []) as any[]).forEach((r) => extBySlug.set(r.slug, { email: r.contact_email, name: r.name }));
    setContacts(
      p.map((row) => {
        const ext = extBySlug.get(row.slug);
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          contact_email: row.contact_email,
          extended_email: ext?.email ?? null,
          extended_slug: ext ? row.slug : null,
        };
      }),
    );
    setDeliveries((d.data ?? []) as DistributionDelivery[]);
    setDeliveryLogs((logs.data ?? []) as DistributionDeliveryLog[]);
    setLoading(false);
  };
  useEffect(() => { void reload(); }, []);

  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
            <Network className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Partner Network</h3>
            <p className="text-xs text-muted-foreground">
              Directory, delivery profiles, metadata templates, connectors, credentials, contacts and delivery history.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      {loading ? (
        <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading partner network…
        </div>
      ) : (
        <Tabs defaultValue="directory" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1.5 h-auto p-1.5 glass rounded-2xl bg-transparent border border-border/50 w-full">
            <TabsTrigger value="directory"><Users className="w-3.5 h-3.5 mr-1" />Directory</TabsTrigger>
            <TabsTrigger value="profiles"><Sliders className="w-3.5 h-3.5 mr-1" />Delivery Profiles</TabsTrigger>
            <TabsTrigger value="templates"><FileJson className="w-3.5 h-3.5 mr-1" />Metadata</TabsTrigger>
            <TabsTrigger value="connectors"><Cable className="w-3.5 h-3.5 mr-1" />Connectors</TabsTrigger>
            <TabsTrigger value="credentials"><KeyRound className="w-3.5 h-3.5 mr-1" />Credentials</TabsTrigger>
            <TabsTrigger value="contacts"><Mail className="w-3.5 h-3.5 mr-1" />Contacts</TabsTrigger>
            <TabsTrigger value="history"><ScrollText className="w-3.5 h-3.5 mr-1" />History</TabsTrigger>
          </TabsList>

          {/* DIRECTORY */}
          <TabsContent value="directory" className="mt-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {partners.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{p.slug}</div>
                    </div>
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "active" : "inactive"}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px]">
                    <span className="px-1.5 py-0.5 rounded border border-border/60 uppercase tracking-wider">{p.protocol}</span>
                    <span className="px-1.5 py-0.5 rounded border border-border/60">pkg: {p.default_package_type}</span>
                    {p.requires_aspera && <span className="px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-300">Aspera</span>}
                    {p.requires_signiant && <span className="px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-300">Signiant</span>}
                  </div>
                  {p.description && <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>}
                </div>
              ))}
              {partners.length === 0 && <div className="text-sm text-muted-foreground italic">No partners.</div>}
            </div>
          </TabsContent>

          {/* DELIVERY PROFILES */}
          <TabsContent value="profiles" className="mt-5">
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40">
              {partners.map((p) => (
                <div key={p.id} className="p-3 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Default: <span className="font-mono">{p.default_package_type}</span> · Supported: {(p.supported_package_types ?? []).join(", ") || "—"}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Window</span>
                  <span className="text-[11px] font-mono">
                    {p.delivery_window ? JSON.stringify(p.delivery_window) : "—"}
                  </span>
                  <Badge variant="outline">{p.protocol}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* METADATA TEMPLATES */}
          <TabsContent value="templates" className="mt-5">
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40 max-h-[520px] overflow-y-auto">
              {mappings.length === 0 && <div className="p-4 text-sm text-muted-foreground italic">No metadata templates configured.</div>}
              {mappings.map((m) => (
                <div key={m.id} className="p-3 grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Partner</div>
                    <div className="truncate">{partnerName(m.partner_id)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Target → Source</div>
                    <div className="font-mono">{m.target_field} ← {m.source_field ?? m.default_value ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Transform</div>
                    <div className="font-mono truncate">{m.transform ?? "identity"}</div>
                  </div>
                  {m.required && <Badge variant="destructive">required</Badge>}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* CONNECTORS */}
          <TabsContent value="connectors" className="mt-5">
            <div className="grid sm:grid-cols-2 gap-3">
              {partners.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/50 bg-secondary/20 p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <Badge variant="outline">{p.protocol}</Badge>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground grid gap-1">
                    <div>host: {cfg(p, "host") || cfg(p, "endpoint") || "—"}</div>
                    <div>port: {cfg(p, "port") || "—"}</div>
                    <div>bucket: {cfg(p, "bucket") || "—"}</div>
                    <div>path: {cfg(p, "base_path") || cfg(p, "remote_path") || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* CREDENTIALS */}
          <TabsContent value="credentials" className="mt-5">
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40">
              {partners.map((p) => (
                <div key={p.id} className="p-3 grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 items-center text-xs">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="font-mono">user: {cfg(p, "username") || cfg(p, "user") || "—"}</div>
                  <div className="font-mono">key: {secretPreview(cfg(p, "api_key") || cfg(p, "access_key") || cfg(p, "token"))}</div>
                  <div className="font-mono">secret: {secretPreview(cfg(p, "secret") || cfg(p, "password") || cfg(p, "secret_key"))}</div>
                </div>
              ))}
              <div className="p-3 text-[11px] text-muted-foreground italic">
                Values are masked previews of what's stored on <code className="font-mono">distribution_partners.config</code>.
                Edit through the existing partner management flow.
              </div>
            </div>
          </TabsContent>

          {/* CONTACTS */}
          <TabsContent value="contacts" className="mt-5">
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40">
              {contacts.map((c) => (
                <div key={c.id} className="p-3 grid grid-cols-[1fr_1fr_1fr] gap-3 items-center text-xs">
                  <div>
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.slug}</div>
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] uppercase text-muted-foreground">Distribution</div>
                    <a className="hover:underline" href={c.contact_email ? `mailto:${c.contact_email}` : undefined}>{c.contact_email ?? "—"}</a>
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] uppercase text-muted-foreground">Partner Profile</div>
                    <a className="hover:underline" href={c.extended_email ? `mailto:${c.extended_email}` : undefined}>{c.extended_email ?? "—"}</a>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* DELIVERY HISTORY */}
          <TabsContent value="history" className="mt-5">
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40 max-h-[560px] overflow-y-auto">
              {deliveries.length === 0 && <div className="p-4 text-sm text-muted-foreground italic">No deliveries yet.</div>}
              {deliveries.map((d) => (
                <div key={d.id} className="p-3 text-xs grid sm:grid-cols-[160px_1fr_auto] gap-2">
                  <div className="text-muted-foreground tabular-nums">
                    {new Date(d.delivered_at ?? d.dispatched_at ?? d.created_at).toLocaleString()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{partnerName(d.partner_id)} · <span className="font-mono">{d.protocol}</span></div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                      attempt #{d.attempt_no} · {(d.bytes_transferred / 1_000_000).toFixed(1)} MB · {d.duration_ms ? `${d.duration_ms}ms` : "—"}
                      {d.error_message ? ` · ${d.error_message}` : ""}
                    </div>
                  </div>
                  <Badge variant={d.status === "ok" ? "default" : d.status === "failed" ? "destructive" : "secondary"}>{d.status}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
