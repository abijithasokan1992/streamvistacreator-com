import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, type TitleRow } from "@/lib/creator/titleApi";
import { StatusBadge } from "@/components/creator/title/StatusBadge";

export default function ScheduleSection() {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const all = await listTitles(user.id);
        setTitles(
          all.filter((t) => ["submitted", "in_review", "qc_review", "legal_review"].includes(t.status))
             .sort((a, b) => +new Date(a.submitted_at ?? a.updated_at) - +new Date(b.submitted_at ?? b.updated_at)),
        );
      } finally { setLoading(false); }
    })();
  }, [user]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (!titles.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-10 text-center">
        <CalendarClock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm">Nothing scheduled.</p>
        <p className="text-xs text-muted-foreground mt-1">Submitted titles will appear here while they're being reviewed.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {titles.map((t) => (
        <li key={t.id} className="rounded-lg border border-border/40 bg-secondary/5 p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{t.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t.submitted_at
                ? `Awaiting review since ${new Date(t.submitted_at).toLocaleDateString()}`
                : "Awaiting review"}
            </p>
          </div>
          <StatusBadge status={t.status} />
        </li>
      ))}
    </ul>
  );
}
