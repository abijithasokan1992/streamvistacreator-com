/**
 * ProductionSetupGate
 * ===================
 * One-time Production Setup shown before the first Studio Ingest for a
 * workspace. Reuses the existing `projects` table (Productions) and, once at
 * least one Production exists, renders the existing StudioIngest surface
 * unchanged.
 *
 * No backend, schema, RBAC, or upload-pipeline changes. Production metadata
 * beyond the base `projects` columns is stored inside the existing `crew`
 * jsonb column so no migration is required.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Clapperboard, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import StudioIngest from "./StudioIngest";

const PRODUCTION_TYPES = [
  "Feature Film", "Series", "Documentary", "Short Film",
  "Commercial", "Music Video", "Animation", "Other",
] as const;

const PRODUCTION_STATUSES = [
  "Pre-Production", "Production", "Post-Production", "Delivery", "Archived",
] as const;

function generateProductionNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRD-${yyyy}${mm}${dd}-${rand}`;
}

export default function ProductionSetupGate() {
  const { user } = useAuth();
  const { activeId, canWriteActive } = useWorkspaces();

  const [checking, setChecking] = useState(true);
  const [hasProduction, setHasProduction] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  const [productionNumber, setProductionNumber] = useState(generateProductionNumber);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("Feature Film");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = useState<string>("Pre-Production");

  // Detect whether the active workspace already has at least one Production.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeId) { setChecking(false); setHasProduction(false); return; }
      setChecking(true);
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", activeId);
      if (!alive) return;
      setHasProduction((count ?? 0) > 0);
      setChecking(false);
    })();
    return () => { alive = false; };
  }, [activeId]);

  const canSubmit = useMemo(
    () => !!activeId && !!user && !!title.trim() && !!company.trim() && !!type && !!startDate && !!status,
    [activeId, user, title, company, type, startDate, status],
  );

  const handleSave = async () => {
    if (!canSubmit || !activeId || !user) return;
    if (!canWriteActive) {
      toast.error("You only have viewer access to this workspace");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("projects").insert({
        workspace_id: activeId,
        user_id: user.id,
        name: title.trim(),
        // Existing jsonb column — packing production metadata here avoids any
        // schema change while remaining editable later.
        crew: {
          production_number: productionNumber,
          production_type: type,
          production_company: company.trim(),
          start_date: startDate,
          production_status: status,
          members: [],
        } as any,
      });
      if (error) throw error;
      toast.success("Production created — starting ingest");
      setHasProduction(true);
    } catch (e) {
      toast.error((e as Error).message || "Failed to create Production");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!activeId) {
    return (
      <Card className="p-6 text-sm text-muted-foreground border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Pick a workspace to begin. Productions and ingest are scoped per workspace.
        </div>
      </Card>
    );
  }

  if (hasProduction) return <StudioIngest />;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Clapperboard className="w-5 h-5" />
            <span className="text-xs uppercase tracking-widest">Production Setup</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Create your first Production</h2>
          <p className="text-sm text-muted-foreground">
            A one-time setup so we can route this workspace's ingest into a real
            Production. Optional metadata (Shoot Day, Unit, Camera, Lens, DIT,
            Director, DOP, reports, VFX plates, stills, docs) can be added later
            — they will not block ingest.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="prod-number">Production Number</Label>
            <div className="flex gap-2">
              <Input
                id="prod-number"
                value={productionNumber}
                onChange={(e) => setProductionNumber(e.target.value)}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setProductionNumber(generateProductionNumber())}
              >
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-generated; editable if your studio uses its own numbering.
            </p>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="prod-title">Production Title</Label>
            <Input
              id="prod-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Untitled Feature 2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-type">Production Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="prod-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-status">Production Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="prod-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="prod-company">Production Company</Label>
            <Input
              id="prod-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Northlight Pictures Pvt. Ltd."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-start">Start Date</Label>
            <Input
              id="prod-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
          Workflow after save: <span className="text-foreground font-medium">Production → RAW Footage Ingest → Checksum Verification → Primary Backup → OCI Cloud Backup → Proxy Generation → Ready for Editorial</span>.
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>) : "Save & start ingest"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
