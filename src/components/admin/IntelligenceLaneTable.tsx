import { ExternalLink } from "lucide-react";

type LaneId = "buyers" | "festivals" | "industry" | "monitor";

export type StructuredLaneData = {
  companies?: Array<{
    name: string;
    url?: string;
    target_genres?: string[];
    recent_acquisitions?: string[];
    region?: string;
    notes?: string;
  }>;
  festivals?: Array<{
    name: string;
    deadline: string;
    submission_url?: string;
    location?: string;
    category?: string;
  }>;
  insights?: Array<{
    headline: string;
    source_url?: string;
    impact_level?: "High" | "Medium" | "Low" | string;
    summary?: string;
    vendor?: string;
    topic?: string;
  }>;
  alerts?: Array<{
    entity: string;
    event?: string;
    detected_at?: string;
    reference_url?: string;
    sentiment?: string;
    summary?: string;
  }>;
  sources?: Array<{ title?: string; url?: string }>;
};

function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function LinkCell({ href, label }: { href?: string; label: string }) {
  if (!isSafeUrl(href)) return <span className="font-medium">{label}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
    >
      {label}
      <ExternalLink className="w-3 h-3 opacity-70" />
    </a>
  );
}

const wrap = "overflow-x-auto rounded-md border border-border/40";
const th = "text-left font-medium px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40";
const td = "px-3 py-2 align-top text-foreground/90";

export function IntelligenceLaneTable({
  lane,
  data,
  errorMessage,
}: {
  lane: LaneId;
  data: StructuredLaneData | null | undefined;
  /**
   * When set, renders a destructive error banner instead of the empty state.
   * Use this to surface upstream failures (e.g. Firecrawl auth/API errors)
   * so admins can distinguish "nothing found" from "integration broken".
   */
  errorMessage?: string | null;
}) {
  if (errorMessage) {
    return (
      <p className="text-xs rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2">
        Structured scan failed: {errorMessage}
      </p>
    );
  }
  if (!data) {
    return <p className="text-xs text-muted-foreground italic">No structured scan yet.</p>;
  }

  if (lane === "buyers") {
    const rows = data.companies ?? [];
    if (!rows.length) return <Empty />;
    return (
      <div className={wrap}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Company</th>
              <th className={th}>Target genres</th>
              <th className={th}>Recent acquisitions</th>
              <th className={th}>Region</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((c, i) => (
              <tr key={`${c.name}-${i}`} className="hover:bg-muted/30">
                <td className={td}>
                  <LinkCell href={c.url} label={c.name} />
                  {c.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{c.notes}</div>}
                </td>
                <td className={td}>{c.target_genres?.join(", ") || "—"}</td>
                <td className={td}>{c.recent_acquisitions?.join(", ") || "—"}</td>
                <td className={td}>{c.region || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (lane === "festivals") {
    const rows = data.festivals ?? [];
    if (!rows.length) return <Empty />;
    return (
      <div className={wrap}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Festival</th>
              <th className={th}>Deadline</th>
              <th className={th}>Location</th>
              <th className={th}>Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((f, i) => (
              <tr key={`${f.name}-${i}`} className="hover:bg-muted/30">
                <td className={td}>
                  <LinkCell href={f.submission_url} label={f.name} />
                </td>
                <td className={`${td} text-destructive font-semibold whitespace-nowrap`}>{f.deadline}</td>
                <td className={td}>{f.location || "—"}</td>
                <td className={td}>{f.category || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (lane === "industry") {
    const rows = data.insights ?? [];
    if (!rows.length) return <Empty />;
    return (
      <div className={wrap}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Headline</th>
              <th className={th}>Impact</th>
              <th className={th}>Topic</th>
              <th className={th}>Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((it, i) => (
              <tr key={`${it.headline}-${i}`} className="hover:bg-muted/30">
                <td className={td}>
                  <LinkCell href={it.source_url} label={it.headline} />
                </td>
                <td className={td}>
                  <ImpactBadge value={it.impact_level} />
                </td>
                <td className={td}>
                  {it.topic || it.vendor ? (
                    <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {it.topic || it.vendor}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${td} text-muted-foreground`}>{it.summary || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (lane === "monitor") {
    const rows = data.alerts ?? [];
    if (!rows.length) return <Empty />;
    return (
      <div className={wrap}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Entity</th>
              <th className={th}>Event</th>
              <th className={th}>Detected</th>
              <th className={th}>Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((m, i) => (
              <tr key={`${m.entity}-${i}`} className="hover:bg-muted/30">
                <td className={`${td} font-medium`}>
                  {m.entity}
                  {m.sentiment && (
                    <div className="mt-1">
                      <SentimentBadge value={m.sentiment} />
                    </div>
                  )}
                </td>
                <td className={`${td} text-muted-foreground`}>{m.event || m.summary || "—"}</td>
                <td className={`${td} whitespace-nowrap`}>{m.detected_at || "—"}</td>
                <td className={td}>
                  {isSafeUrl(m.reference_url) ? (
                    <LinkCell href={m.reference_url} label={safeHost(m.reference_url!)} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

function Empty() {
  return (
    <p className="text-xs text-muted-foreground italic">
      No structured records extracted from this run.
    </p>
  );
}

function SentimentBadge({ value }: { value?: string }) {
  const v = (value ?? "").toLowerCase();
  const cls =
    v === "positive"
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
      : v === "negative"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : "bg-muted text-muted-foreground border-border/60";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      {value || "neutral"}
    </span>
  );
}

function ImpactBadge({ value }: { value?: string }) {
  const v = (value ?? "").toLowerCase();
  const cls =
    v === "high"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : v === "medium"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : v === "low"
          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
          : "bg-muted text-muted-foreground border-border/60";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      {value || "—"}
    </span>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
