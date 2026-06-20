import { useEffect, useState } from "react";
import { Plus, Database, FileText, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, type TitleRow } from "@/lib/creator/titleApi";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { ComingSoonGrid } from "./ComingSoonGrid";
import { UploadDiagnostics } from "@/components/creator/UploadDiagnostics";
import WhatHappensNext from "@/components/creator/WhatHappensNext";
import ReviewNotesInbox from "@/components/creator/ReviewNotesInbox";
import CreatorReviewFeedback from "@/components/creator/CreatorReviewFeedback";
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

  const gbUsed = (storageBytes / 1024 / 1024 / 1024).toFixed(2);
  const recent = [...titles]
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Primary CTA */}
      <button
        onClick={() => onNavigate("titles")}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-5 text-left flex items-center gap-3"
      >
        <Plus className="w-5 h-5 text-accent" />
        <div>
          <p className="font-semibold">Create New Title</p>
          <p className="text-xs text-muted-foreground mt-0.5">Start a new title, upload assets, and submit for admin review.</p>
        </div>
      </button>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Stat icon={FileText} label="Title Count" value={String(titles.length)}
          hint="All titles in your account." />
        <Stat icon={Database} label="Storage Usage" value={`${gbUsed} GB`}
          hint="Across all uploads to Oracle Object Storage." />
      </div>

      {/* In-flight / stuck upload diagnostics */}
      <UploadDiagnostics />

      {/* Active review status guidance */}
      <WhatHappensNext />

      {/* Latest review notes from the admin team */}
      <ReviewNotesInbox />
      <CreatorReviewFeedback />





      {/* Recent Updates */}
      <div className="rounded-xl border border-border/40 bg-secondary/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Recent Updates
          </h2>
          <button className="text-xs text-accent hover:underline" onClick={() => onNavigate("titles")}>
            View all →
          </button>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground px-4 py-6">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-6">No titles yet. Create your first title to get started.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {recent.map((t) => (
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
