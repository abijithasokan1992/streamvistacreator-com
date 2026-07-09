/**
 * TitleDistributionPanel — mounted inside TitleEditor as the "Distribution" tab.
 *
 * Lets a creator:
 *   1. Build a package from EXISTING media versions + assets (no new upload)
 *   2. Enqueue the package to one or more configured partners
 *   3. See queue/delivery status inline
 *
 * The heavier hub view (logs, partner catalogue) lives in DistributionHub.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Package as PackageIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  listPackagesForTitle, createPackage, buildPackageManifest,
  listPartners, enqueueDelivery, dispatchQueue, listQueueForTitle,
  type DistributionPartner, type DistributionPackage, type DistributionQueueItem,
} from "@/lib/distribution/distributionApi";
import { DistributionHub } from "./DistributionHub";

type MediaVersion = { id: string; kind: string; codec?: string | null; container?: string | null };
type TitleAsset  = { id: string; kind: string };

export function TitleDistributionPanel({
  titleId, workspaceId, readOnly,
}: {
  titleId: string;
  workspaceId?: string | null;
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<MediaVersion[]>([]);
  const [assets, setAssets] = useState<TitleAsset[]>([]);
  const [partners, setPartners] = useState<DistributionPartner[]>([]);
  const [packages, setPackages] = useState<DistributionPackage[]>([]);
  const [queue, setQueue] = useState<DistributionQueueItem[]>([]);

  const [pickedVersions, setPickedVersions] = useState<Set<string>>(new Set());
  const [pickedAssets, setPickedAssets] = useState<Set<string>>(new Set());
  const [packageType, setPackageType] = useState<string>("imf");
  const [pickedPartner, setPickedPartner] = useState<string>("");
  const [pickedPackage, setPickedPackage] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    const [v, a, p, pk, q] = await Promise.all([
      (supabase as any).from("title_media_versions").select("id,kind,codec,container").eq("title_id", titleId),
      (supabase as any).from("title_assets").select("id,kind").eq("title_id", titleId),
      listPartners(),
      listPackagesForTitle(titleId),
      listQueueForTitle(titleId),
    ]);
    setVersions((v.data ?? []) as MediaVersion[]);
    setAssets((a.data ?? []) as TitleAsset[]);
    setPartners(p);
    setPackages(pk);
    setQueue(q);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [titleId]);

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    apply(next);
  };

  const readyPackages = useMemo(() => packages.filter(p => p.status === "ready"), [packages]);

  const onBuild = async () => {
    if (readOnly) return;
    setBusy(true);
    try {
      const pkg = await createPackage({
        title_id: titleId,
        workspace_id: workspaceId ?? null,
        package_type: packageType,
        included_media_version_ids: [...pickedVersions],
        included_asset_ids: [...pickedAssets],
      });
      if (!pkg) throw new Error("Could not create package");
      const built = await buildPackageManifest(pkg.id);
      toast({ title: "Package built", description: `${(Number(built?.size_bytes ?? 0)/1_000_000_000).toFixed(2)} GB manifest ready` });
      setPickedVersions(new Set()); setPickedAssets(new Set());
      await reload();
    } catch (e) {
      toast({ title: "Build failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!pickedPackage || !pickedPartner) {
      toast({ title: "Pick a package and a partner", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const item = await enqueueDelivery({
        package_id: pickedPackage, partner_id: pickedPartner, title_id: titleId,
      });
      if (item) await dispatchQueue(item.id, item.correlation_id ?? undefined);
      toast({ title: "Dispatched to partner" });
      await reload();
    } catch (e) {
      toast({ title: "Dispatch failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Packaging engine */}
      <section className="rounded-xl border border-border/40 bg-secondary/10 p-4 space-y-4">
        <div>
          <h3 className="font-display text-base flex items-center gap-2"><PackageIcon className="w-4 h-4 text-accent" /> Build package</h3>
          <p className="text-xs text-muted-foreground mt-1">Assemble a delivery package from existing media versions and assets on this title.</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Package type</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {["imf","prores","mp4","xml_only"].map(t => (
              <button
                key={t}
                onClick={() => setPackageType(t)}
                disabled={readOnly}
                className={`px-2.5 py-1 rounded-md text-xs border ${packageType===t ? "bg-accent text-accent-foreground border-accent" : "border-border/50 hover:bg-secondary/30"}`}
              >{t.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <PickList
            title={`Media versions (${versions.length})`}
            empty="No media versions on this title yet."
            items={versions.map(v => ({ id: v.id, label: `${v.kind}${v.codec ? ` · ${v.codec}` : ""}${v.container ? ` · ${v.container}` : ""}` }))}
            picked={pickedVersions}
            onToggle={id => toggle(pickedVersions, id, setPickedVersions)}
            disabled={readOnly}
          />
          <PickList
            title={`Assets (${assets.length})`}
            empty="No assets on this title yet."
            items={assets.map(a => ({ id: a.id, label: a.kind }))}
            picked={pickedAssets}
            onToggle={id => toggle(pickedAssets, id, setPickedAssets)}
            disabled={readOnly}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={onBuild} disabled={busy || readOnly || (pickedVersions.size + pickedAssets.size === 0)}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PackageIcon className="w-3.5 h-3.5 mr-1.5" />}
            Build package
          </Button>
        </div>
      </section>

      {/* Send to partner */}
      <section className="rounded-xl border border-border/40 bg-secondary/10 p-4 space-y-3">
        <div>
          <h3 className="font-display text-base flex items-center gap-2"><Send className="w-4 h-4 text-accent" /> Send to partner</h3>
          <p className="text-xs text-muted-foreground mt-1">Deliver a ready package to a configured distribution partner. Retries are automatic.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Package</label>
            <select
              value={pickedPackage}
              onChange={e => setPickedPackage(e.target.value)}
              className="w-full mt-1 rounded-md border border-border/50 bg-background/50 px-2 py-1.5 text-sm"
              disabled={readOnly}
            >
              <option value="">Select a ready package…</option>
              {readyPackages.map(p => (
                <option key={p.id} value={p.id}>{p.package_type.toUpperCase()} · {(p.size_bytes/1_000_000_000).toFixed(2)} GB · {new Date(p.created_at).toLocaleDateString()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Partner</label>
            <select
              value={pickedPartner}
              onChange={e => setPickedPartner(e.target.value)}
              className="w-full mt-1 rounded-md border border-border/50 bg-background/50 px-2 py-1.5 text-sm"
              disabled={readOnly}
            >
              <option value="">Select a partner…</option>
              {partners.filter(p => p.is_active).map(p => (
                <option key={p.id} value={p.id}>{p.name} · {p.protocol.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-muted-foreground">
            Live queue: {queue.filter(q => q.status !== "delivered" && q.status !== "cancelled").length} pending · {queue.filter(q => q.status === "failed").length} failed
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => reload()} size="sm">Refresh</Button>
            <Button onClick={onSend} disabled={busy || readOnly || !pickedPackage || !pickedPartner} size="sm">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Dispatch
            </Button>
          </div>
        </div>
        {queue.some(q => q.status === "failed") && (
          <div className="text-xs text-red-300/90">
            Some deliveries failed for this title. See the Distribution section for logs and retry.
          </div>
        )}
      </section>

      {/* Full hub summary inline */}
      <DistributionHub titleId={titleId} />
    </div>
  );
}

function PickList({
  title, empty, items, picked, onToggle, disabled,
}: {
  title: string; empty: string;
  items: { id: string; label: string }[];
  picked: Set<string>; onToggle: (id: string) => void; disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3">
      <p className="text-xs font-medium mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-auto list-none">
          {items.map(i => (
            <li key={i.id}>
              <label className={`flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-secondary/20 cursor-pointer ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                <input
                  type="checkbox"
                  checked={picked.has(i.id)}
                  onChange={() => onToggle(i.id)}
                  className="accent-current"
                  disabled={disabled}
                />
                <span className="truncate">{i.label}</span>
                {picked.has(i.id) && <Badge variant="outline" className="ml-auto text-[9px]">included</Badge>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
