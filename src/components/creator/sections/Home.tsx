import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FilePlus, Database, Inbox, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, type TitleRow } from "@/lib/creator/titleApi";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { ComingSoonGrid } from "./ComingSoonGrid";
import type { SectionId } from "@/components/creator/CreatorSidebar";

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1.5 font-display">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground/70 mt-1">{hint}</div>}
    </div>
  );
}

export default function HomeSection({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [storageBytes, setStorageBytes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [t, storage] = await Promise.all([
          listTitles(user.id),
          (supabase as any)
            .from("recent_uploads")
            .select("file_size")
            .eq("user_id", user.id),
        ]);
        setTitles(t);
        const total = (storage.data ?? []).reduce(
          (sum: number, r: any) => sum + (Number(r.file_size) || 0), 0,
        );
        setStorageBytes(total);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const drafts = titles.filter((t) => t.status === "draft" || t.status === "incomplete" || t.status === "changes_requested");
  const submitted = titles.filter((t) => t.status === "submitted");
  const inReview = titles.filter((t) => ["in_review", "qc_review", "legal_review"].includes(t.status));
  const gbUsed = (storageBytes / 1024 / 1024 / 1024).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Priority CTAs */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate("titles")}
          className="rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-5 text-left"
        >
          <Plus className="w-4 h-4 text-accent mb-2" />
          <p className="font-semibold">Create New Title</p>
          <p className="text-xs text-muted-foreground mt-1">Start a new title and upload your assets.</p>
        </button>
        <button
          onClick={() => onNavigate("titles")}
          className="rounded-xl border border-border/50 bg-secondary/10 hover:bg-secondary/20 p-5 text-left"
        >
          <FilePlus className="w-4 h-4 mb-2" />
          <p className="font-semibold">Continue Draft</p>
          <p className="text-xs text-muted-foreground mt-1">
            {drafts.length ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"} in progress.` : "No drafts in progress."}
          </p>
        </button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={Database} label="Storage Used" value={`${gbUsed} GB`} hint="Across all uploads." />
        <Stat icon={Inbox} label="Submitted Titles" value={String(submitted.length)} hint="Awaiting admin pickup." />
        <Stat icon={Eye} label="Under Review" value={String(inReview.length)} hint="QC, legal or review queues." />
      </div>

      {/* Recent titles preview */}
      <div className="rounded-xl border border-border/40 bg-secondary/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h2 className="text-sm font-semibold">Recent titles</h2>
          <button className="text-xs text-accent hover:underline" onClick={() => onNavigate("titles")}>
            View all →
          </button>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground px-4 py-6">Loading…</p>
        ) : titles.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-6">No titles yet. Create your first title to get started.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {titles.slice(0, 5).map((t) => (
              <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Updated {new Date(t.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ComingSoonGrid />
    </div>
  );
}
