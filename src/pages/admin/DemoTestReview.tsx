import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { applyQuarantineOnlyFilterToTitlesQuery } from "@/lib/operations/productionFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

/**
 * Founder-only review view for rows quarantined by Batch 2
 * (metadata.is_test = true). Read-only. Nothing on this page mutates data.
 *
 * Access is restricted to `founder`, `platform_owner` and `super_admin`
 * roles via `useUserRoles`. Unauthorized visitors are redirected to
 * `/admin` where their own scope-appropriate view is rendered.
 */

type QuarantinedTitle = {
  id: string;
  title: string;
  status: string;
  owner_user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const CLASS_LABEL: Record<string, string> = {
  seed: "Seed",
  internal_test: "Internal test",
  system_test: "System test",
  pre_production: "Pre-production",
  demo: "Demo",
  test: "Test",
  archived: "Archived",
};

const CLASS_TONE: Record<string, string> = {
  seed: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  internal_test: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  system_test: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  pre_production: "bg-sky-500/15 text-sky-700 border-sky-500/30",
};

export default function DemoTestReview() {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const [rows, setRows] = useState<QuarantinedTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPrivileged = useMemo(
    () =>
      roles.some((r) =>
        (["founder", "platform_owner", "super_admin", "admin"] as const).includes(r as any),
      ),
    [roles],
  );

  useEffect(() => {
    if (!user || !isPrivileged) return;
    let cancelled = false;
    (async () => {
      const base = supabase
        .from("content_titles")
        .select("id,title,status,owner_user_id,created_at,metadata")
        .order("created_at", { ascending: false })
        .limit(500);
      const filtered = applyQuarantineOnlyFilterToTitlesQuery(base);
      const { data, error: err } = await filtered;
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      setRows((data ?? []) as QuarantinedTitle[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPrivileged]);

  if (authLoading || rolesLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isPrivileged) return <Navigate to="/admin" replace />;

  const grouped = useMemo(() => {
    const g: Record<string, QuarantinedTitle[]> = {};
    for (const r of rows ?? []) {
      const cls = String((r.metadata as any)?.data_classification ?? "unclassified");
      (g[cls] ||= []).push(r);
    }
    return g;
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Demo &amp; Test — quarantined records</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Founder-only review view. Every row here has{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">metadata.is_test = true</code>{" "}
          and is excluded from every operational counter (Mission Control, QC, Legal, Draft,
          Approved, Ready for Distribution, Buyer Mapping, Accounts, Revenue, Recent Activity).
          Nothing here is deleted, and nothing on this page mutates data — reclassification is a
          separate, audited action.
        </p>
      </header>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">Failed to load: {error}</CardContent>
        </Card>
      )}

      {rows == null && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading quarantined records…
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total: {rows.length}</Badge>
            {Object.entries(grouped).map(([cls, list]) => (
              <Badge
                key={cls}
                variant="outline"
                className={CLASS_TONE[cls] ?? "bg-muted text-muted-foreground"}
              >
                {(CLASS_LABEL[cls] ?? cls)}: {list.length}
              </Badge>
            ))}
          </div>

          {Object.entries(grouped).map(([cls, list]) => (
            <Card key={cls}>
              <CardHeader>
                <CardTitle className="text-base">
                  {CLASS_LABEL[cls] ?? cls}{" "}
                  <span className="text-muted-foreground">({list.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Owner user id</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((r) => {
                      const meta = (r.metadata ?? {}) as any;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[26rem] truncate text-xs text-muted-foreground">
                            {meta.quarantined_reason ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-[11px]">
                            {r.owner_user_id ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
