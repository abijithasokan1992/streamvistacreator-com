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
  items?: Array<{
    headline: string;
    vendor?: string;
    topic?: string;
    summary?: string;
    url?: string;
  }>;
  mentions?: Array<{
    brand: string;
    sentiment?: string;
    summary?: string;
    source?: string;
    url?: string;
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
}: {
  lane: LaneId;
  data: StructuredLaneData | null | undefined;
}) {
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
    const rows = data.items ?? [];
    if (!rows.length) return <Empty />;
    return (
      <div className={wrap}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Headline</th>
              <th className={th}>Vendor</th>
              <th className={th}>Topic</th>
              <th className={th}>Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((it, i) => (
              <tr key={`${it.headline}-${i}`} className="hover:bg-muted/30">
                <td className={td}>
                  <LinkCell href={it.url} label={it.headline} />
                </td>
                <td className={td}>{it.vendor || "—"}</td>
                <td className={td}>
                  {it.topic ? (
                    <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {it.topic}
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
    const rows = data.mentions ?? [];
    if (!rows.length) return <Empty />;
    return (
      <div className={wrap}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Brand</th>
              <th className={th}>Sentiment</th>
              <th className={th}>Summary</th>
              <th className={th}>Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((m, i) => (
              <tr key={`${m.brand}-${i}`} className="hover:bg-muted/30">
                <td className={`${td} font-medium`}>{m.brand}</td>
                <td className={td}>
                  <SentimentBadge value={m.sentiment} />
                </td>
                <td className={`${td} text-muted-foreground`}>{m.summary || "—"}</td>
                <td className={td}>
                  {isSafeUrl(m.url) ? (
                    <LinkCell href={m.url} label={m.source || safeHost(m.url!)} />
                  ) : (
                    m.source || "—"
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

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
