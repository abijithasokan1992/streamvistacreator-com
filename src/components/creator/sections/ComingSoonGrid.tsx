import { Sparkles } from "lucide-react";

export function ComingSoon({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-10 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent mb-3">
        <Sparkles className="w-4 h-4" />
      </div>
      <h2 className="font-semibold text-base">{title}</h2>
      {body && <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{body}</p>}
      <span className="inline-block mt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 border border-border/50 rounded-full px-3 py-1">
        Coming Soon
      </span>
    </div>
  );
}

const FUTURE = [
  { title: "Buyer Marketplace",      body: "Discoverable catalog for buyers and aggregators." },
  { title: "Licensing Marketplace",  body: "Issue and track licenses with territory + term controls." },
  { title: "Distribution Marketplace", body: "Push titles to distribution partners and platforms." },
  { title: "Revenue Share",          body: "Per-title revenue splits across stakeholders." },
  { title: "Partner Network",        body: "Connect with verified creators and studios." },
  { title: "Localization Workflows", body: "Dub, subtitle and metadata localization workflows." },
  { title: "FAST Channels",          body: "Programmed FAST channels powered by your catalog." },
  { title: "OTT Delivery",           body: "Direct delivery into OTT platforms via Oracle." },
  { title: "Advanced Analytics",     body: "Deeper performance, viewership and revenue analytics." },
];

export function ComingSoonGrid() {
  return (
    <details className="mt-10 group">
      <summary className="cursor-pointer list-none flex items-center justify-between rounded-xl border border-border/40 bg-secondary/5 px-4 py-3 hover:bg-secondary/10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Roadmap</p>
          <p className="text-sm font-medium mt-0.5">Modules on the roadmap — not available yet</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 group-open:hidden">Show</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 hidden group-open:inline">Hide</span>
      </summary>
      <p className="text-xs text-muted-foreground mt-3 px-1">
        These are directional and not part of the current Creator workspace. No timelines committed.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        {FUTURE.map((f) => (
          <div key={f.title} className="rounded-xl border border-border/40 bg-secondary/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{f.title}</h3>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Roadmap</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
