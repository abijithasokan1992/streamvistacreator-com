import { useState } from "react";
import { Plus, Globe, Film, FileText, ListChecks } from "lucide-react";
import {
  QuickActionCard, QuickActionGrid, HelpDrawer,
} from "@/components/shared/tools";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DrawerKey = null | "rights" | "screener" | "note";

export default function BuyerQuickActions({
  onNewRequest,
  onCatalogRequest,
}: {
  onNewRequest: () => void;
  onCatalogRequest: () => void;
}) {
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteTerritory, setNoteTerritory] = useState("");
  const [noteOffer, setNoteOffer] = useState("");
  const [noteTerm, setNoteTerm] = useState("");
  const [noteExtra, setNoteExtra] = useState("");

  const noteOutput = [
    noteTitle && `Title: ${noteTitle}`,
    noteTerritory && `Territory: ${noteTerritory}`,
    noteOffer && `Offer: ${noteOffer}`,
    noteTerm && `Term: ${noteTerm}`,
    noteExtra && `Notes: ${noteExtra}`,
  ].filter(Boolean).join("\n");

  return (
    <>
      <QuickActionGrid
        title="Buyer Tools"
        description="Guided shortcuts for acquisition, licensing, and screener requests."
        cols={3}
      >
        <QuickActionCard
          icon={Plus}
          title="New Request Wizard"
          description="Start an acquisition, licensing, screener, or rights enquiry."
          cta="Start"
          tone="accent"
          onClick={onNewRequest}
        />
        <QuickActionCard
          icon={Globe}
          title="Rights Scope Helper"
          description="Quick reference for territory + rights category + exclusivity."
          cta="Open helper"
          onClick={() => setDrawer("rights")}
        />
        <QuickActionCard
          icon={Film}
          title="Screener Request Guide"
          description="How NDA-gated screeners work and what to include in your ask."
          cta="Read guide"
          onClick={() => setDrawer("screener")}
        />
        <QuickActionCard
          icon={FileText}
          title="Commercial Note Builder"
          description="Compose a clear, copy-paste commercial note for admin."
          cta="Build note"
          onClick={() => setDrawer("note")}
        />
        <QuickActionCard
          icon={ListChecks}
          title="Catalog / Acquisition Request"
          description="Looking for something specific? Send a catalog enquiry."
          cta="Send enquiry"
          onClick={onCatalogRequest}
        />
      </QuickActionGrid>

      <HelpDrawer
        open={drawer === "rights"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Rights Scope Helper"
      >
        <p><strong>Territory</strong> — Worldwide, India, South Asia, Middle East, Europe, North America, LATAM, etc. Pick one or a region cluster.</p>
        <p><strong>Rights category</strong> — SVOD, AVOD, TVOD, Theatrical, Broadcast TV, Airline / Non-theatrical, Remake / IP, Clip / Promo.</p>
        <p><strong>Exclusivity</strong> — Exclusive (locks all other deals in scope) vs Non-exclusive (multiple licensees allowed). Pick "Open to either" when negotiable.</p>
        <p><strong>Term</strong> — Common buckets: &lt; 1 yr, 1–3 yrs, 3–5 yrs, 5+ yrs, Perpetual.</p>
        <p className="text-muted-foreground">Tip: the narrower the scope, the faster admin can match a title for you.</p>
      </HelpDrawer>

      <HelpDrawer
        open={drawer === "screener"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Screener Request Guide"
      >
        <ol className="space-y-2 list-decimal pl-4">
          <li>Send a screener request from <em>New Request</em>.</li>
          <li>If you haven't, you'll be asked to accept the buyer confidentiality NDA.</li>
          <li>Admin verifies your enquiry and loops in the title owner.</li>
          <li>Approved screeners appear in your <em>Approved screeners</em> count and inside the Screening Room.</li>
          <li>Access is logged and watermarked; do not share or redistribute.</li>
        </ol>
      </HelpDrawer>

      <HelpDrawer
        open={drawer === "note"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Commercial Note Builder"
        description="Fill in what you can. We'll format it cleanly."
      >
        <div className="space-y-2">
          <input
            placeholder="Title or brief"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm"
          />
          <input
            placeholder="Territory (e.g. India + South Asia)"
            value={noteTerritory}
            onChange={(e) => setNoteTerritory(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm"
          />
          <input
            placeholder="Offer (e.g. USD 50K MG + 50/50 rev share)"
            value={noteOffer}
            onChange={(e) => setNoteOffer(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm"
          />
          <input
            placeholder="Term (e.g. 3 yrs, non-exclusive)"
            value={noteTerm}
            onChange={(e) => setNoteTerm(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm"
          />
          <Textarea
            placeholder="Anything else"
            value={noteExtra}
            onChange={(e) => setNoteExtra(e.target.value)}
            className="min-h-[64px]"
          />
        </div>
        {noteOutput && (
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 whitespace-pre-wrap text-xs font-mono">
            {noteOutput}
          </div>
        )}
        <Button
          size="sm"
          disabled={!noteOutput}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(noteOutput);
              toast.success("Note copied");
            } catch {
              toast.error("Copy failed");
            }
          }}
        >
          Copy note
        </Button>
      </HelpDrawer>
    </>
  );
}
