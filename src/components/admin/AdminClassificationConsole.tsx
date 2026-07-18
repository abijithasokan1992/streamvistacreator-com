import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Grade = "a" | "b" | "c";
type Mode = "titles" | "partners";
type GradeRow = {
  id: string;
  label: string;
  detail: string;
  grade: Grade | null;
  kind: string;
};

const GRADE_COPY: Record<Grade, string> = {
  a: "A · Priority",
  b: "B · Standard",
  c: "C · Development",
};

export default function AdminClassificationConsole() {
  const [mode, setMode] = useState<Mode>("titles");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GradeRow | null>(null);
  const [grade, setGrade] = useState<Grade>("b");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [schemaPending, setSchemaPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaPending(false);
    if (mode === "titles") {
      const { data, error } = await (supabase as any)
        .from("content_titles")
        .select("id,title,status,owner_email,content_grade")
        .in("status", ["submitted", "in_review", "qc_review", "legal_review", "approved", "ready_for_distribution"])
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) {
        setSchemaPending(String(error.message || "").includes("content_grade"));
        setRows([]);
      } else {
        setRows((data || []).map((r: any) => ({
          id: r.id,
          label: r.title || "Untitled",
          detail: r.owner_email || r.status || "Title",
          grade: r.content_grade || null,
          kind: "title",
        })));
      }
    } else {
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("user_id,full_name,display_name,organization_name,primary_role,partner_grade")
        .in("primary_role", ["creator", "studio", "buyer"])
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) {
        setSchemaPending(String(error.message || "").includes("partner_grade"));
        setRows([]);
      } else {
        setRows((data || []).map((r: any) => ({
          id: r.user_id,
          label: r.organization_name || r.full_name || r.display_name || "Unnamed partner",
          detail: r.primary_role || "partner",
          grade: r.partner_grade || null,
          kind: r.primary_role || "partner",
        })));
      }
    }
    setLoading(false);
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    a: rows.filter(r => r.grade === "a").length,
    b: rows.filter(r => r.grade === "b").length,
    c: rows.filter(r => r.grade === "c").length,
    ungraded: rows.filter(r => !r.grade).length,
  }), [rows]);

  const save = async () => {
    if (!selected || reason.trim().length < 3) {
      toast.error("Add a short reason for the grade.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("admin_set_commercial_grade", {
      _entity_type: mode === "titles" ? "title" : "partner",
      _entity_id: selected.id,
      _grade: grade,
      _reason: reason.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Grade could not be saved.");
      return;
    }
    toast.success(`${selected.label} → Grade ${grade.toUpperCase()}`);
    setSelected(null);
    setReason("");
    await load();
  };

  return (
    <section className="rounded-2xl border border-border/50 bg-secondary/10 p-4 md:p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Commercial Classification</p>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> A / B / C Grading</h2>
          <p className="text-xs text-muted-foreground">Internal priority only. It never auto-publishes, rejects, deletes, or changes user access.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={mode === "titles" ? "default" : "outline"} onClick={() => setMode("titles")}>Films</Button>
          <Button size="sm" variant={mode === "partners" ? "default" : "outline"} onClick={() => setMode("partners")}>Creators · Studios · Buyers</Button>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg border p-2">A <strong className="block text-lg">{counts.a}</strong></div>
        <div className="rounded-lg border p-2">B <strong className="block text-lg">{counts.b}</strong></div>
        <div className="rounded-lg border p-2">C <strong className="block text-lg">{counts.c}</strong></div>
        <div className="rounded-lg border p-2">Pending <strong className="block text-lg">{counts.ungraded}</strong></div>
      </div>

      {schemaPending ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Database update pending. Classification will activate after the reviewed migration is applied.
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left"><tr><th className="p-3">Name</th><th className="p-3">Type / Owner</th><th className="p-3">Grade</th><th className="p-3"></th></tr></thead>
            <tbody>{rows.map(row => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-medium">{row.label}</td>
                <td className="p-3 text-muted-foreground capitalize">{row.detail}</td>
                <td className="p-3">{row.grade ? <Badge variant="outline">{GRADE_COPY[row.grade]}</Badge> : "—"}</td>
                <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => { setSelected(row); setGrade(row.grade || "b"); }}>Classify</Button></td>
              </tr>
            ))}{rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No matching records.</td></tr>}</tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="rounded-xl border bg-background/60 p-4 space-y-3">
          <div className="font-medium">{selected.label}</div>
          <Select value={grade} onValueChange={(v) => setGrade(v as Grade)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">A · Priority / strongest fit</SelectItem>
              <SelectItem value="b">B · Standard / normal handling</SelectItem>
              <SelectItem value="c">C · Development / needs improvement</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this internal grade…" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save grade</Button>
          </div>
        </div>
      )}
    </section>
  );
}
