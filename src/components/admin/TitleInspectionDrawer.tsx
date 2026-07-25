import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, RotateCcw, Rocket, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { OFFICE } from "@/lib/admin/labels";

type TitleRow = {
  id: string;
  title: string | null;
  status: string | null;
  qc_status: string | null;
  legal_clearance: string | null;
};

type AssetRow = {
  id: string;
  category: string;
  is_primary: boolean;
  upload_id: string;
};

type Upload = {
  id: string;
  file_name: string;
  mime_type: string | null;
  par_url: string | null;
};

export function TitleInspectionDrawer({
  titleId, open, onOpenChange, canDecide = false,
}: {
  titleId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canDecide?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState<TitleRow | null>(null);
  const [assets, setAssets] = useState<Array<AssetRow & { upload: Upload | null }>>([]);
  const [acting, setActing] = useState<null | "approve" | "sendback" | "ready">(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open || !titleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: t }, { data: a }] = await Promise.all([
          supabase.from("content_titles").select("id,title,status,qc_status,legal_clearance").eq("id", titleId).maybeSingle(),
          supabase.from("title_assets").select("id,category,is_primary,upload_id").eq("title_id", titleId).order("is_primary", { ascending: false }),
        ]);
        if (cancelled) return;
        setTitle((t as TitleRow) ?? null);
        const uploadIds = (a ?? []).map((x: any) => x.upload_id).filter(Boolean);
        let uploads: Upload[] = [];
        if (uploadIds.length) {
          const { data: u } = await supabase
            .from("recent_uploads")
            .select("id,file_name,mime_type,par_url")
            .in("id", uploadIds);
          uploads = (u as Upload[]) ?? [];
        }
        setAssets((a ?? []).map((x: any) => ({ ...x, upload: uploads.find((u) => u.id === x.upload_id) ?? null })));
      } catch (e: any) {
        toast.error("Couldn't load this movie's details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, titleId]);

  const isVideo = (mime?: string | null) => (mime ?? "").startsWith("video/");
  const isImage = (mime?: string | null) => (mime ?? "").startsWith("image/");
  const isDoc = (mime?: string | null, cat?: string) =>
    !isVideo(mime) && !isImage(mime) && (cat === "censor_certificate" || cat === "ownership_documents" || cat === "legal" || (mime ?? "").includes("pdf"));

  const preview = assets.find((a) => a.category === "trailer" && isVideo(a.upload?.mime_type))
    ?? assets.find((a) => a.category === "feature_film" && isVideo(a.upload?.mime_type))
    ?? assets.find((a) => isVideo(a.upload?.mime_type));

  const artworks = assets.filter((a) => a.category === "poster" || a.category === "artwork" || isImage(a.upload?.mime_type));
  const documents = assets.filter((a) => isDoc(a.upload?.mime_type, a.category));

  const runAction = async (kind: "approve" | "sendback" | "ready") => {
    if (!title) return;
    if (kind === "sendback" && reason.trim().length < 5) {
      toast.error("Add a short reason so the creator knows what to fix.");
      return;
    }
    setActing(kind);
    try {
      const patch: Record<string, any> = {};
      if (kind === "approve") { patch.status = "approved"; patch.approved_at = new Date().toISOString(); }
      if (kind === "sendback") { patch.status = "changes_requested"; patch.review_notes = reason.trim(); }
      if (kind === "ready") { patch.status = "ready_for_distribution"; }
      const { error } = await (supabase.from("content_titles") as any).update(patch).eq("id", title.id);
      if (error) throw error;
      toast.success(kind === "approve" ? "Approved" : kind === "sendback" ? "Sent back to creator" : "Marked ready");
      setTimeout(() => onOpenChange(false), 800);
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed. Nothing was saved.");
    } finally {
      setActing(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-6 truncate">{title?.title ?? "Movie details"}</SheetTitle>
          <SheetDescription>
            Status: <span className="font-medium">{title?.status ?? "—"}</span>
            {" · "}QC: <span className="font-medium">{title?.qc_status ?? "—"}</span>
            {" · "}Legal: <span className="font-medium">{title?.legal_clearance ?? "—"}</span>
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-6 space-y-8">
            <section>
              <h3 className="text-sm font-semibold mb-2">Preview</h3>
              {preview?.upload?.par_url ? (
                <video controls src={preview.upload.par_url} className="w-full rounded-lg border border-border/40 bg-black" />
              ) : (
                <div className="text-xs text-muted-foreground p-4 rounded-lg border border-dashed border-border/40">
                  No trailer or master file available for preview.
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Artwork</h3>
              {artworks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No poster or banner uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {artworks.map((a) => (
                    <a key={a.id} href={a.upload?.par_url ?? "#"} target="_blank" rel="noreferrer" className="block aspect-[2/3] rounded-md overflow-hidden border border-border/40 bg-secondary/20">
                      {a.upload?.par_url ? (
                        <img src={a.upload.par_url} alt={a.category} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">{a.category}</div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Documents</h3>
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contracts or certificates on file.</p>
              ) : (
                <ul className="space-y-1.5">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm rounded-md border border-border/40 px-3 py-2">
                      <span className="truncate">{d.upload?.file_name ?? d.category}</span>
                      {d.upload?.par_url ? (
                        <a href={d.upload.par_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open</a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unavailable</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canDecide && (
              <section className="space-y-3 pt-2 border-t border-border/40">
                <h3 className="text-sm font-semibold">Actions</h3>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for sending back (required only for Send Back)"
                  rows={2}
                  className="w-full text-sm rounded-md border border-border/50 bg-background px-3 py-2"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!!acting}
                    onClick={() => runAction("approve")}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {acting === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {OFFICE.approve}
                  </button>
                  <button
                    disabled={!!acting}
                    onClick={() => runAction("sendback")}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary disabled:opacity-60"
                  >
                    {acting === "sendback" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    {OFFICE.sendBack}
                  </button>
                  <button
                    disabled={!!acting}
                    onClick={() => runAction("ready")}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-60"
                  >
                    {acting === "ready" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {OFFICE.markReady}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default TitleInspectionDrawer;
