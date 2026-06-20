import { useEffect, useState } from "react";
import { Clock, ArrowRight, MessageSquareWarning, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import type { ContentStatus } from "@/lib/creator/titleApi";

type ActiveTitle = {
  id: string;
  title: string;
  status: ContentStatus;
  updated_at: string;
};

const ACTIVE_STAGES: ContentStatus[] = [
  "submitted","in_review","qc_review","legal_review",
  "approved","ready_for_distribution","changes_requested",
];

const STAGE_COPY: Record<string, { what: string; next: string }> = {
  submitted: {
    what: "Your title is in the admin submission queue.",
    next: "A reviewer will pick it up shortly and move it into Review.",
  },
  in_review: {
    what: "Editorial reviewers are checking your metadata and assets.",
    next: "Next step is Quality Control (QC). You don't need to do anything.",
  },
  qc_review: {
    what: "QC is validating your video, audio and deliverable specs.",
    next: "On pass it moves to Legal review. If anything is off you'll see a Changes Requested note.",
  },
  legal_review: {
    what: "Legal is verifying your censor certificate and ownership documents.",
    next: "On pass your title will be Approved.",
  },
  approved: {
    what: "Your title has cleared review.",
    next: "Admins will mark it Ready For Distribution once packaging is complete.",
  },
  ready_for_distribution: {
    what: "Your title is Ready For Distribution.",
    next: "Buyer / marketplace surfacing comes online in a future release.",
  },
  changes_requested: {
    what: "Reviewers have requested changes.",
    next: "Open the title, address the notes, and re-submit.",
  },
};

export default function WhatHappensNext({ onOpenTitle }: { onOpenTitle?: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ActiveTitle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("content_titles")
        .select("id, title, status, updated_at")
        .eq("owner_user_id", user.id)
        .in("status", ACTIVE_STAGES)
        .order("updated_at", { ascending: false })
        .limit(5);
      setRows((data ?? []) as ActiveTitle[]);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5">
      <div className="px-4 py-3 border-b border-accent/20 flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold">What happens next</h2>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {rows.length} active title{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="divide-y divide-accent/15">
        {rows.map((t) => {
          const copy = STAGE_COPY[t.status] ?? {
            what: "Your title is in progress.",
            next: "Watch this space for status updates.",
          };
          const needsAction = t.status === "changes_requested";
          return (
            <li key={t.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate flex-1">{t.title}</p>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-start gap-2 text-xs">
                {needsAction
                  ? <MessageSquareWarning className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  : <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />}
                <div className="space-y-1">
                  <p className="text-foreground/80">{copy.what}</p>
                  <p className="text-muted-foreground inline-flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> {copy.next}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
