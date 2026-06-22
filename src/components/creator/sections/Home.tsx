import { useEffect, useState } from "react";
import { Plus, Clock, Sparkles, Crown, ArrowRight, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, type TitleRow } from "@/lib/creator/titleApi";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import { UploadDiagnostics } from "@/components/creator/UploadDiagnostics";
import WhatHappensNext from "@/components/creator/WhatHappensNext";
import ReviewNotesInbox from "@/components/creator/ReviewNotesInbox";
import CreatorReviewFeedback from "@/components/creator/CreatorReviewFeedback";
import WorkspaceWelcome from "@/components/creator/WorkspaceWelcome";
import type { SectionId } from "@/components/creator/CreatorSidebar";

type UpdateRow = { id: string; title: string; message: string | null; created_at: string };

export default function HomeSection({ onNavigate, isFree }: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [t, n] = await Promise.all([
          listTitles(user.id),
          (supabase as any).from("notifications")
            .select("id, title, message, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
        ]);
        setTitles(t);
        setUpdates((n.data ?? []) as UpdateRow[]);
      } finally { setLoading(false); }
    })();
  }, [user]);

  const recent = [...titles]
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. Workspace identity + at-a-glance summary */}
      <WorkspaceWelcome />

      {/* 2. Primary action */}
      <button
        onClick={() => onNavigate("titles")}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-5 text-left flex items-center gap-3"
      >
        <Plus className="w-5 h-5 text-accent" />
        <div className="flex-1">
          <p className="font-semibold">Create a new title</p>
          <p className="text-xs text-muted-foreground mt-0.5">Start a draft, upload assets, and submit for admin review.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* 3. Upload health + active review status */}
      <UploadDiagnostics />
      <WhatHappensNext />
      <ReviewNotesInbox />
      <CreatorReviewFeedback />

      {/* 4. Recent titles */}
      <div className="rounded-xl border border-border/40 bg-secondary/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Recent titles
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

      {/* 5. Important updates from StreamVista */}
      <div className="rounded-xl border border-border/40 bg-secondary/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" /> Important updates
          </h2>
          <button className="text-xs text-accent hover:underline" onClick={() => onNavigate("updates")}>
            View all →
          </button>
        </div>
        {updates.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-6">No new announcements right now.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {updates.map((u) => (
              <li key={u.id} className="px-4 py-3">
                <p className="text-sm font-medium">{u.title}</p>
                {u.message && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{u.message}</p>}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {new Date(u.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 6. Upgrade CTA — Free only */}
      {isFree && (
        <button
          onClick={() => onNavigate("upgrade")}
          className="w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-accent/5 p-5 text-left flex items-start gap-4 hover:from-amber-500/15"
        >
          <div className="rounded-full bg-amber-500/15 p-2.5">
            <Crown className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Ready for more titles, storage and priority review?</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Creator Pro and Studio plans unlock larger catalogs, priority QC, dedicated workflow support and
              studio-scale vault options — provisioned by our team.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-accent mt-2 font-medium">
              See packages <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      )}

      {/* What's coming — paid users only, collapsed by default */}
      {!isFree && <WhatsComing />}
    </div>
  );
}

const FUTURE = [
  { title: "Licensing Marketplace",   body: "Issue and track licenses with territory + term controls." },
  { title: "Distribution Marketplace", body: "Push titles to distribution partners and platforms." },
  { title: "Revenue Share",            body: "Per-title revenue splits across stakeholders." },
  { title: "Localization Workflows",   body: "Dub, subtitle and metadata localization workflows." },
  { title: "FAST Channels",            body: "Programmed FAST channels powered by your catalog." },
  { title: "Advanced Analytics",       body: "Deeper viewership and revenue analytics." },
];

function WhatsComing() {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none flex items-center justify-between rounded-xl border border-border/40 bg-secondary/5 px-4 py-3 hover:bg-secondary/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <p className="text-sm font-medium">What's coming next</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Show</span>
      </summary>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        {FUTURE.map((f) => (
          <div key={f.title} className="rounded-xl border border-border/40 bg-secondary/5 p-4">
            <h3 className="font-medium text-sm">{f.title}</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
