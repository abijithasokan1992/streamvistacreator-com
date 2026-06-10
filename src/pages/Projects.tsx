import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Loader2, Film, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Production banner ENUM values that match `production_house_type` in Postgres. */
export const PRODUCTION_BANNERS = [
  { value: "CRAYONS_PICTURES", label: "Crayons Pictures" },
  { value: "ABHIJITH_ASOKAN_PRODUCTIONS", label: "Abhijith Asokan Productions" },
] as const;
export type ProductionBanner = (typeof PRODUCTION_BANNERS)[number]["value"];

const bannerLabel = (v: string) =>
  PRODUCTION_BANNERS.find((b) => b.value === v)?.label ?? v;

type Project = {
  id: string;
  name: string;
  description: string | null;
  production_banner: ProductionBanner;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  description: string;
  production_banner: ProductionBanner | "";
};

const emptyForm: FormState = { name: "", description: "", production_banner: "" };

export default function Projects() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, production_banner, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Project[]);
  };

  useEffect(() => { load(); }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      production_banner: p.production_banner,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) return toast.error("Project name is required");
    if (!form.production_banner) return toast.error("Production banner is required");

    setSaving(true);
    const payload = {
      name,
      description: form.description.trim() || null,
      production_banner: form.production_banner as ProductionBanner,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("projects")
        .insert({ ...payload, user_id: user.id }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);

    toast.success(editing ? "Project updated" : "Project created");
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  };

  const remove = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    setRows((r) => r.filter((x) => x.id !== p.id));
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 sticky top-0 z-30 backdrop-blur bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="font-display font-bold text-lg">My Projects</h1>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </div>
      </header>

      <section className="container py-8">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border/60 rounded-xl p-10 text-center">
            <Film className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No projects yet. Create your first one to start routing assets.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => (
              <Card key={p.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">{p.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => remove(p)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit gap-1 text-[10px] font-mono uppercase tracking-wider">
                    <Film className="w-3 h-3" />
                    {bannerLabel(p.production_banner)}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3 min-h-[2.5rem]">
                    {p.description || "No description"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-3">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "Create Project"}</DialogTitle>
            <DialogDescription>
              Route each project's assets to the correct production banner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proj-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Untitled Feature 2026"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-banner">
                Production Banner <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.production_banner}
                onValueChange={(v) => setForm((f) => ({ ...f, production_banner: v as ProductionBanner }))}
              >
                <SelectTrigger id="proj-banner">
                  <SelectValue placeholder="Select a banner…" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTION_BANNERS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Assets uploaded against this project will be routed under the selected banner.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief logline or working notes (optional)"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
