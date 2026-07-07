import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, ClipboardCheck, UploadCloud, Receipt, Sparkles, LifeBuoy,
} from "lucide-react";
import {
  QuickActionCard, QuickActionGrid, HelpDrawer,
} from "@/components/shared/tools";
import type { SectionId } from "@/components/creator/CreatorSidebar";
import type { FreeTierStatus, TitleRow } from "@/lib/creator/titleApi";

type DrawerKey = null | "readiness" | "upload" | "commercial";

const READINESS_CHECKS = [
  "Title metadata complete (synopsis, genre, language, certification)",
  "Primary poster uploaded (slot 1)",
  "Trailer uploaded and verified",
  "Main film uploaded if you want to include the full-length file",
  "Rights & availability filled in Legal tab",
  "Existing contracts uploaded (if applicable)",
  "Commercial path selected (Revenue Share / Buy-out)",
];

const UPLOAD_GUIDE = [
  "Recommended master: ProRes 422 HQ, DNxHR HQX, or MP4 H.264 ≥ 25 Mbps.",
  "Trailer: MP4 H.264, 1080p, 60–120s.",
  "Poster: 2000×3000 px JPG/PNG, < 8 MB.",
  "Existing contracts: PDF, < 25 MB each, name them clearly.",
  "Large masters? Use the resumable uploader inside the title → Assets tab.",
];

export default function CreatorQuickActions({
  onNavigate,
  isFree,
  tier,
  titles,
}: {
  onNavigate: (s: SectionId) => void;
  isFree: boolean;
  tier: FreeTierStatus | null;
  titles: TitleRow[];
}) {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<DrawerKey>(null);

  const drafts = titles.filter((t) => t.status === "draft" || t.status === "incomplete").length;
  const submitted = titles.filter((t) =>
    ["submitted", "in_review", "qc_review", "legal_review"].includes(t.status),
  ).length;
  const approved = titles.filter((t) => t.status === "approved" || t.status === "ready_for_distribution").length;

  return (
    <>
      <QuickActionGrid
        title="Creator Tools"
        description="Guided shortcuts for the work you do most."
        cols={3}
      >
        <QuickActionCard
          icon={Plus}
          title="New Title"
          description="Start a draft and we'll guide you through details, files and submission."
          cta="Start"
          tone="accent"
          onClick={() => onNavigate("titles")}
        />
        <QuickActionCard
          icon={ClipboardCheck}
          title="Ready to Submit"
          description="See exactly what's missing before you submit."
          cta="Run check"
          onClick={() => setDrawer("readiness")}
        />
        <QuickActionCard
          icon={UploadCloud}
          title="Submission Guide"
          description="Recommended file formats, sizes and settings."
          cta="Open guide"
          onClick={() => setDrawer("upload")}
        />
        <QuickActionCard
          icon={Receipt}
          title="Business Options"
          description={isFree
            ? "Free plan defaults: Worldwide · Revenue Share · Non-exclusive."
            : "Premium: per-territory rights and buy-out options."}
          cta="View details"
          onClick={() => setDrawer("commercial")}
        />
        <QuickActionCard
          icon={Sparkles}
          title="Plan & Upgrade"
          description={isFree ? "Upgrade for more storage and multiple submissions." : "Manage your plan and add-ons."}
          cta="Go to Billing"
          tone={isFree ? "warning" : "default"}
          onClick={() => onNavigate("billing")}
        />
        <QuickActionCard
          icon={LifeBuoy}
          title="Get Support"
          description="Reach our team for reviews, payments or technical help."
          cta="Get support"
          onClick={() => onNavigate("help")}
        />
      </QuickActionGrid>

      <HelpDrawer
        open={drawer === "readiness"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Submission Readiness"
        description={`You have ${drafts} draft${drafts === 1 ? "" : "s"}, ${submitted} in review, ${approved} approved.`}
      >
        <p className="text-muted-foreground">Before submitting a title, confirm:</p>
        <ul className="space-y-2">
          {READINESS_CHECKS.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => { setDrawer(null); onNavigate("titles"); }}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open my titles →
        </button>
      </HelpDrawer>

      <HelpDrawer
        open={drawer === "upload"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Metadata & Asset Upload Guide"
        description="Recommended formats and sizes."
      >
        <ul className="space-y-2">
          {UPLOAD_GUIDE.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </HelpDrawer>

      <HelpDrawer
        open={drawer === "commercial"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Commercial Path Summary"
      >
        {isFree ? (
          <>
            <p>Free plan creators ship with these defaults locked in:</p>
            <ul className="space-y-2 mt-2">
              <li>• Territory: <strong>Worldwide</strong></li>
              <li>• Model: <strong>Revenue Share</strong></li>
              <li>• Exclusivity: <strong>Non-exclusive</strong></li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              Need per-territory rights, buy-outs, or exclusive deals? Upgrade to unlock the full rights matrix.
            </p>
            <button
              onClick={() => { setDrawer(null); navigate("/pricing"); }}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              See pricing →
            </button>
          </>
        ) : (
          <>
            <p>Premium plans unlock the full rights matrix:</p>
            <ul className="space-y-2 mt-2">
              <li>• Per-territory rights selection</li>
              <li>• Revenue Share or Buy-out</li>
              <li>• Exclusive / Non-exclusive</li>
              <li>• Custom commercial notes per deal</li>
            </ul>
          </>
        )}
      </HelpDrawer>
    </>
  );
}
