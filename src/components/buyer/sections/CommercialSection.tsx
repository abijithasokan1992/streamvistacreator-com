import { useState } from "react";
import { Handshake, Package, FileText, Globe, Film, ScrollText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { HelpDrawer } from "@/components/shared/tools";
import { RequestCard } from "../requests/RequestCard";
import { ACTIVE_STATES, type Row } from "../requests/shared";
import DeliveriesSection from "./DeliveriesSection";
import { cn } from "@/lib/utils";

type Tab = "active" | "deliveries" | "documents";
type DrawerKey = null | "rights" | "note" | "nda";

export default function CommercialSection({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>("active");
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteTerritory, setNoteTerritory] = useState("");
  const [noteOffer, setNoteOffer] = useState("");
  const [noteTerm, setNoteTerm] = useState("");
  const [noteExtra, setNoteExtra] = useState("");

  const active = rows.filter(r => ACTIVE_STATES.includes(r.state));
  const noteOutput = [
    noteTitle && `Title: ${noteTitle}`,
    noteTerritory && `Territory: ${noteTerritory}`,
    noteOffer && `Offer: ${noteOffer}`,
    noteTerm && `Term: ${noteTerm}`,
    noteExtra && `Notes: ${noteExtra}`,
  ].filter(Boolean).join("\n");

  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-display text-xl">Commercial</h2>
        <p className="text-sm text-muted-foreground">
          Active licensing, agreements, deliveries and commercial documents in one place.
        </p>
      </header>

      <div role="tablist" aria-label="Commercial views" className="inline-flex rounded-lg border border-border/50 p-1 bg-secondary/20 text-xs">
        {(["active", "deliveries", "documents"] as const).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "active" ? `Active licensing (${active.length})` : t === "deliveries" ? "Deliveries" : "Documents & tools"}
          </button>
        ))}
      </div>

      {tab === "active" && (
        <div className="space-y-3">
          {active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
              <Handshake className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
              <h3 className="font-semibold">No commercial discussions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Approved requests moving toward agreement will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3 list-none">
              {active.map(r => <li key={r.id}><RequestCard row={r} /></li>)}
            </ul>
          )}
        </div>
      )}

      {tab === "deliveries" && <DeliveriesSection />}

      {tab === "documents" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <DocTile icon={Globe}      title="Rights scope helper"     body="Territory, category, exclusivity, term references."   onClick={() => setDrawer("rights")} />
          <DocTile icon={FileText}   title="Commercial note builder" body="Compose a clean, copy-paste commercial note for admin." onClick={() => setDrawer("note")} />
          <DocTile icon={ScrollText} title="NDA guide"                body="How the buyer confidentiality NDA works."               onClick={() => setDrawer("nda")} />
          <DocTile icon={Package}    title="Delivery format guide"    body="Preferred package specs for approved deliveries."       onClick={() => setTab("deliveries")} />
          <DocTile icon={Film}       title="Screener protocol"        body="Watermark, expiry, view logging."                       onClick={() => setDrawer("nda")} />
        </div>
      )}

      <HelpDrawer open={drawer === "rights"} onOpenChange={(o) => !o && setDrawer(null)} title="Rights scope helper">
        <p><strong>Territory</strong> — Worldwide, India, South Asia, Middle East, Europe, North America, LATAM, etc.</p>
        <p><strong>Rights category</strong> — SVOD, AVOD, TVOD, Theatrical, Broadcast TV, Airline / Non-theatrical, Remake / IP, Clip / Promo.</p>
        <p><strong>Exclusivity</strong> — Exclusive locks all other deals in scope; Non-exclusive allows multiple licensees.</p>
        <p><strong>Term</strong> — Common buckets: &lt; 1 yr, 1–3 yrs, 3–5 yrs, 5+ yrs, Perpetual.</p>
        <p className="text-muted-foreground">Tip: the narrower the scope, the faster admin can match a title.</p>
      </HelpDrawer>

      <HelpDrawer open={drawer === "nda"} onOpenChange={(o) => !o && setDrawer(null)} title="NDA & screener protocol">
        <ol className="space-y-2 list-decimal pl-4">
          <li>Every screener request requires the buyer confidentiality NDA.</li>
          <li>Admin verifies your enquiry and loops in the title owner.</li>
          <li>Approved screeners are watermarked with your identity and time-limited.</li>
          <li>All views are logged; do not share, download or redistribute.</li>
          <li>Access can be revoked if terms are violated.</li>
        </ol>
      </HelpDrawer>

      <HelpDrawer
        open={drawer === "note"}
        onOpenChange={(o) => !o && setDrawer(null)}
        title="Commercial note builder"
        description="Fill in what you can. We'll format it cleanly."
      >
        <div className="space-y-2">
          <input placeholder="Title or brief"                              value={noteTitle}     onChange={(e) => setNoteTitle(e.target.value)}     className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm" />
          <input placeholder="Territory (e.g. India + South Asia)"         value={noteTerritory} onChange={(e) => setNoteTerritory(e.target.value)} className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm" />
          <input placeholder="Offer (e.g. USD 50K MG + 50/50 rev share)"    value={noteOffer}     onChange={(e) => setNoteOffer(e.target.value)}     className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm" />
          <input placeholder="Term (e.g. 3 yrs, non-exclusive)"            value={noteTerm}      onChange={(e) => setNoteTerm(e.target.value)}      className="w-full h-9 px-3 rounded-md bg-secondary/30 border border-border/60 text-sm" />
          <Textarea placeholder="Anything else" value={noteExtra} onChange={(e) => setNoteExtra(e.target.value)} className="min-h-[64px]" />
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
            try { await navigator.clipboard.writeText(noteOutput); toast.success("Note copied"); }
            catch { toast.error("Copy failed"); }
          }}
        >
          Copy note
        </Button>
      </HelpDrawer>
    </section>
  );
}

function DocTile({
  icon: Icon, title, body, onClick,
}: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-border/40 bg-secondary/10 p-4 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition"
    >
      <Icon className="w-4 h-4 text-accent" aria-hidden />
      <div className="text-sm font-semibold mt-2">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
    </button>
  );
}
