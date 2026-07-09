import { useEffect, useState } from "react";
import { Loader2, Radio, PackageIcon, Send, ScrollText, Cable, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  listPartners, listQueueForTitle, listDeliveriesForTitle, listDeliveryLogs,
  listPackagesForTitle, retryFailedDeliveries, dispatchQueue,
  type DistributionPartner, type DistributionPackage,
  type DistributionQueueItem, type DistributionDelivery, type DistributionDeliveryLog,
} from "@/lib/distribution/distributionApi";
import { cn } from "@/lib/utils";
import { PartnerMetadataMappingEditor } from "./PartnerMetadataMappingEditor";

const STATUS_TONE: Record<string, string> = {
  queued: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  dispatching: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  retrying: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-secondary text-muted-foreground border-border/60",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pending: "bg-secondary text-muted-foreground border-border/60",
};

const PROTO_ICON: Record<string, string> = {
  api: "API", http_webhook: "Webhook", ftp: "FTP", sftp: "SFTP",
  aspera: "Aspera", signiant: "Signiant", s3: "S3",
};

export function DistributionHub({ titleId }: { titleId: string }) {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<DistributionPartner[]>([]);
  const [packages, setPackages] = useState<DistributionPackage[]>([]);
  const [queue, setQueue] = useState<DistributionQueueItem[]>([]);
  const [deliveries, setDeliveries] = useState<DistributionDelivery[]>([]);
  const [logs, setLogs] = useState<Record<string, DistributionDeliveryLog[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mappingsOpen, setMappingsOpen] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [p, q, d, pk] = await Promise.all([
      listPartners(),
      listQueueForTitle(titleId),
      listDeliveriesForTitle(titleId),
      listPackagesForTitle(titleId),
    ]);
    setPartners(p);
    setQueue(q);
    setDeliveries(d);
    setPackages(pk);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [titleId]);

  const partnerName = (id: string) => partners.find(p => p.id === id)?.name ?? "Partner";
  const partnerProto = (id: string) => partners.find(p => p.id === id)?.protocol ?? "api";

  const onDispatch = async (id: string) => {
    const { error } = await dispatchQueue(id);
    if (error) toast({ title: "Dispatch failed", description: error.message, variant: "destructive" });
    else toast({ title: "Dispatch triggered" });
    void reload();
  };

  const onRetry = async () => {
    try {
      const n = await retryFailedDeliveries(titleId);
      toast({ title: `Requeued ${n} failed deliveries` });
      void reload();
    } catch (e) {
      toast({ title: "Retry failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const expandLogs = async (deliveryId: string) => {
    if (expanded === deliveryId) { setExpanded(null); return; }
    if (!logs[deliveryId]) {
      const l = await listDeliveryLogs(deliveryId);
      setLogs(prev => ({ ...prev, [deliveryId]: l }));
    }
    setExpanded(deliveryId);
  };

  if (loading) {
    return (
      <div className="py-12 grid place-items-center" role="status" aria-label="Loading distribution hub">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg flex items-center gap-2"><Radio className="w-4 h-4 text-accent" /> Distribution Hub</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Package existing masters and deliver to partners over API, FTP/SFTP, Aspera or Signiant. Reuses your title assets and media versions — nothing is re-uploaded.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onRetry} className="min-h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry failed
        </Button>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList>
          <TabsTrigger value="queue"><Send className="w-3.5 h-3.5 mr-1.5" />Queue</TabsTrigger>
          <TabsTrigger value="packages"><PackageIcon className="w-3.5 h-3.5 mr-1.5" />Packages</TabsTrigger>
          <TabsTrigger value="deliveries"><ScrollText className="w-3.5 h-3.5 mr-1.5" />Deliveries</TabsTrigger>
          <TabsTrigger value="partners"><Cable className="w-3.5 h-3.5 mr-1.5" />Partners</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {queue.length === 0 ? (
            <Empty text="No queued deliveries. Enqueue a package below to dispatch it to a partner." />
          ) : (
            <ul className="space-y-2 list-none">
              {queue.map(q => (
                <li key={q.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[q.status])}>{q.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{PROTO_ICON[partnerProto(q.partner_id)]}</Badge>
                      <span className="text-sm font-medium">{partnerName(q.partner_id)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Attempt {q.attempts}/{q.max_attempts}
                      {q.next_retry_at && <> · retry {new Date(q.next_retry_at).toLocaleString()}</>}
                      {q.correlation_id && <> · <span className="font-mono">{q.correlation_id.slice(0,8)}</span></>}
                    </div>
                    {q.last_error && <p className="text-xs text-red-300/90 mt-1 break-words">{q.last_error_code}: {q.last_error}</p>}
                  </div>
                  {(q.status === "queued" || q.status === "retrying" || q.status === "failed") && (
                    <Button size="sm" onClick={() => onDispatch(q.id)}>Dispatch</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="packages" className="mt-4">
          {packages.length === 0 ? (
            <Empty text="No packages yet. Use the Distribution panel on a title to build one from existing media versions and assets." />
          ) : (
            <ul className="space-y-2 list-none">
              {packages.map(p => (
                <li key={p.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[p.status] ?? "bg-secondary text-muted-foreground border-border/60")}>{p.status}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">{p.package_type}</Badge>
                    <span className="text-xs text-muted-foreground">{(p.size_bytes/1_000_000_000).toFixed(2)} GB</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                  {p.build_error && <p className="text-xs text-red-300/90 mt-1">{p.build_error}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4">
          {deliveries.length === 0 ? (
            <Empty text="Delivery attempts and partner acknowledgements appear here." />
          ) : (
            <ul className="space-y-2 list-none">
              {deliveries.map(d => (
                <li key={d.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                  <button
                    onClick={() => expandLogs(d.id)}
                    className="w-full flex items-center gap-2 flex-wrap text-left"
                  >
                    <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[d.status])}>{d.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{PROTO_ICON[d.protocol]}</Badge>
                    <span className="text-sm font-medium">{partnerName(d.partner_id)}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      #{d.attempt_no} · {d.duration_ms ? `${d.duration_ms}ms` : "—"} · {new Date(d.created_at).toLocaleString()}
                    </span>
                  </button>
                  {d.error_message && <p className="text-xs text-red-300/90 mt-1 break-words">{d.error_code}: {d.error_message}</p>}
                  {d.ack_reference && <p className="text-[10px] text-emerald-300/80 mt-1">Ack: {d.ack_reference}</p>}
                  {expanded === d.id && (
                    <ul className="mt-3 space-y-1 border-t border-border/30 pt-2 list-none">
                      {(logs[d.id] ?? []).map(l => (
                        <li key={l.id} className="text-[11px] font-mono flex gap-2">
                          <span className={cn(
                            l.level === "error" ? "text-red-300" : l.level === "warn" ? "text-amber-300" : "text-muted-foreground"
                          )}>{new Date(l.created_at).toLocaleTimeString()}</span>
                          <span className="text-muted-foreground">[{l.stage}]</span>
                          <span className="flex-1 break-words">{l.message}</span>
                        </li>
                      ))}
                      {(logs[d.id] ?? []).length === 0 && <li className="text-[11px] text-muted-foreground">No log entries.</li>}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="partners" className="mt-4">
          {partners.length === 0 ? (
            <Empty text="No distribution partners configured. Ask an administrator to add them under Platform → Partners." />
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3 list-none">
              {partners.map(p => (
                <li key={p.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{p.name}</span>
                    <Badge variant="outline" className="text-[10px]">{PROTO_ICON[p.protocol]}</Badge>
                    {!p.is_active && <Badge className="text-[10px] bg-secondary text-muted-foreground border-border/60">inactive</Badge>}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Default: {p.default_package_type} · Supports: {p.supported_package_types.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-secondary/10 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
