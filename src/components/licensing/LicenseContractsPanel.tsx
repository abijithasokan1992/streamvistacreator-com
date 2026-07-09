import { useEffect, useState } from "react";
import { Loader2, FileSignature, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  createContract, listContracts, updateContractStatus, type LicenseContract,
} from "@/lib/licensing/licensingApi";

/**
 * Contract Management panel attached to a deal_memo. Reuses deal_memos as the
 * commercial record; adds only versioned document + signature state.
 */
export function LicenseContractsPanel({
  dealMemoId,
  titleId,
  canManage,
  className,
}: {
  dealMemoId: string;
  titleId?: string | null;
  canManage: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<LicenseContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [legalText, setLegalText] = useState("");

  const load = async () => {
    try { setLoading(true); setItems(await listContracts(dealMemoId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load contracts"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dealMemoId]);

  const addVersion = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await createContract({
        deal_memo_id: dealMemoId,
        title_id: titleId ?? null,
        document_url: docUrl.trim() || null,
        legal_text: legalText.trim() || null,
        created_by: user.id,
      });
      setDocUrl(""); setLegalText("");
      toast.success("Contract version created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create contract");
    } finally { setSaving(false); }
  };

  const setStatus = async (c: LicenseContract, patch: Partial<LicenseContract>) => {
    try { await updateContractStatus(c.id, patch as never); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
          <FileSignature className="w-4 h-4 text-accent" aria-hidden /> Contract management
        </h4>
        <Badge variant="outline" className="text-[10px]">{items.length} version{items.length !== 1 ? "s" : ""}</Badge>
      </div>

      {loading ? (
        <div className="py-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" aria-hidden /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/50 bg-secondary/10 p-3">
          No contract versions yet.
        </p>
      ) : (
        <ul className="space-y-2 list-none">
          {items.map(c => (
            <li key={c.id} className="rounded-lg border border-border/40 bg-secondary/10 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">v{c.version}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{c.status.replaceAll("_", " ")}</Badge>
              </div>
              {c.document_url && (
                <a
                  href={c.document_url}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden /> Open document
                </a>
              )}
              {c.legal_text && <p className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-3">{c.legal_text}</p>}
              {canManage && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, { status: "sent" })}>Mark sent</Button>
                  )}
                  {(c.status === "sent" || c.status === "draft") && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, { status: "buyer_signed", buyer_signed_at: new Date().toISOString() })}>Buyer signed</Button>
                  )}
                  {c.status === "buyer_signed" && (
                    <Button size="sm" onClick={() => setStatus(c, { status: "fully_signed", countersigned_at: new Date().toISOString(), countersigned_by: user?.id ?? null })}>Countersign</Button>
                  )}
                  {c.status !== "void" && c.status !== "fully_signed" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(c, { status: "void" })}>Void</Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-3 grid gap-2 rounded-lg border border-border/40 bg-secondary/5 p-3">
          <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="Document URL (PDF, signed portal link…)" />
          <Textarea value={legalText} onChange={(e) => setLegalText(e.target.value)} placeholder="Legal text snapshot (optional)" rows={3} />
          <div className="flex justify-end">
            <Button size="sm" onClick={addVersion} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden /> : <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden />}
              New version
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
