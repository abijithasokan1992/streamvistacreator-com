import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud, HardDrive, Wrench, Activity, Receipt,
} from "lucide-react";
import {
  QuickActionCard, QuickActionGrid, HelpDrawer,
} from "@/components/shared/tools";

type DrawerKey = null | "planner" | "diagnostics";

export default function StudioQuickActions({
  hasUsable,
  totalGb,
  usedGb,
  onOpenIngest,
  onOpenBilling,
  onOpenLibrary,
  onRequestService,
  onRequestPlan,
}: {
  hasUsable: boolean;
  totalGb: number;
  usedGb: number;
  onOpenIngest: () => void;
  onOpenBilling: () => void;
  onOpenLibrary: () => void;
  onRequestService?: () => void;
  onRequestPlan?: () => void;
}) {
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const navigate = useNavigate();
  const availableGb = Math.max(0, totalGb - usedGb);

  return (
    <>
      <QuickActionGrid
        title="Studio Tools"
        description="Guided shortcuts for ingest, storage planning, and service requests."
        cols={3}
      >
        <QuickActionCard
          icon={UploadCloud}
          title="Ingest Setup Wizard"
          description="Configure camera-to-cloud or hard-disk intake step by step."
          cta="Start setup"
          tone="accent"
          onClick={onOpenIngest}
        />
        <QuickActionCard
          icon={HardDrive}
          title="Storage Planner"
          description={hasUsable
            ? `${availableGb.toFixed(1)} GB available — plan headroom for upcoming shoots.`
            : "Estimate the storage you need before you buy."}
          cta="Plan storage"
          onClick={() => setDrawer("planner")}
        />
        <QuickActionCard
          icon={Wrench}
          title="Service Request Wizard"
          description="Proxies, QC, restore, delivery, archive — founder-assisted."
          cta="Request service"
          onClick={() => { if (onRequestService) onRequestService(); else onOpenBilling(); }}
        />
        <QuickActionCard
          icon={Activity}
          title="Upload / Ingest Diagnostics"
          description="Stuck upload? Run through the common fixes."
          cta="Open helper"
          onClick={() => setDrawer("diagnostics")}
        />
        <QuickActionCard
          icon={Receipt}
          title="Plan / Storage Request"
          description="Need more capacity or a custom plan? Send a quick request."
          cta="Send request"
          onClick={() => { if (onRequestPlan) onRequestPlan(); else onOpenBilling(); }}
        />
      </QuickActionGrid>

      <HelpDrawer
        open={drawer === "planner"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Storage Planner"
        description="A quick rule of thumb for studio capacity."
      >
        <p>Rough sizing for a typical project:</p>
        <ul className="space-y-2">
          <li>• <strong>4K ProRes 422 HQ</strong> — ~75 GB / hour</li>
          <li>• <strong>4K H.265 8-bit</strong> — ~12 GB / hour</li>
          <li>• <strong>HD ProRes 422</strong> — ~25 GB / hour</li>
          <li>• <strong>Proxies (1080p H.264)</strong> — ~5 GB / hour</li>
        </ul>
        <p className="text-muted-foreground">
          Add ~30% headroom for masters + deliveries. Currently:&nbsp;
          <strong>{totalGb.toFixed(0)} GB allocated</strong>, {usedGb.toFixed(1)} GB used.
        </p>
        <button
          onClick={() => { setDrawer(null); onOpenBilling(); }}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open Billing →
        </button>
      </HelpDrawer>

      <HelpDrawer
        open={drawer === "diagnostics"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Upload / Ingest Diagnostics"
        description="Try these before raising a ticket."
      >
        <ul className="space-y-2">
          <li>• Confirm storage is activated (Billing → Storage status).</li>
          <li>• Browser upload: try a fresh tab; avoid VPNs that throttle uploads.</li>
          <li>• Files &gt; 50 GB: prefer Camera-to-Cloud or Hard-Disk Intake.</li>
          <li>• Check available quota — pause uploads if &lt; 5% headroom.</li>
          <li>• Still stuck? Send a Service Request with the title + filename.</li>
        </ul>
        <button
          onClick={() => { setDrawer(null); onOpenLibrary(); }}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open Library →
        </button>
      </HelpDrawer>
    </>
  );
}
