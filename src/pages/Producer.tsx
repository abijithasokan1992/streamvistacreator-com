import { useEffect, useState } from "react";
import { Loader2, Users, FileVideo, LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBackGuard } from "@/hooks/useBackGuard";

type CreatorRow = { id: string; user_id: string; email?: string };
type FileRow = {
  id: string;
  filename: string;
  size_bytes: number;
  tier: string;
  created_at: string;
  owner_id: string;
  download_count: number;
};

function fmtSize(b: number) {
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

export default function Producer() {
  const { user, signOut } = useAuth();
  useBackGuard(!!user);
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // RLS scopes producer_assignments to rows where ep_user_id = me.
      const { data: asg } = await supabase
        .from("producer_assignments")
        .select("id, creator_user_id");
      const creatorIds = (asg || []).map((a) => a.creator_user_id);
      setCreators((asg || []).map((a) => ({ id: a.id, user_id: a.creator_user_id })));

      if (creatorIds.length === 0) {
        setFiles([]);
        setLoading(false);
        return;
      }
      // RLS allows EP to SELECT files where is_producer_of(me, owner_id).
      const { data: f } = await supabase
        .from("shared_files")
        .select("id, filename, size_bytes, tier, created_at, owner_id, download_count")
        .in("owner_id", creatorIds)
        .order("created_at", { ascending: false })
        .limit(200);
      setFiles((f || []) as FileRow[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">Executive Producer</div>
              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            <button onClick={signOut} className="px-3 py-2 text-sm rounded-md border border-border/60 hover:bg-secondary inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        <section className="grid sm:grid-cols-2 gap-4">
          <div className="glass-strong rounded-2xl p-5 border border-border/40">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Users className="w-3.5 h-3.5" /> Assigned creators</div>
            <div className="text-3xl font-display font-bold mt-2">{creators.length}</div>
          </div>
          <div className="glass-strong rounded-2xl p-5 border border-border/40">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><FileVideo className="w-3.5 h-3.5" /> Files in oversight</div>
            <div className="text-3xl font-display font-bold mt-2">{files.length}</div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold mb-3">Recent uploads from your creators</h2>
          {loading ? (
            <div className="text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : files.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground border border-border/40">
              No creators assigned yet. Ask an admin to link Creator accounts to your Executive Producer profile.
            </div>
          ) : (
            <div className="glass rounded-2xl border border-border/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">File</th>
                    <th className="text-left p-3 hidden sm:table-cell">Tier</th>
                    <th className="text-right p-3">Size</th>
                    <th className="text-right p-3 hidden sm:table-cell">Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id} className="border-t border-border/40">
                      <td className="p-3 truncate max-w-[260px]" title={f.filename}>{f.filename}</td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{f.tier === "sovereign" ? "India Secure" : "Standard"}</td>
                      <td className="p-3 text-right font-mono">{fmtSize(f.size_bytes)}</td>
                      <td className="p-3 text-right hidden sm:table-cell">{f.download_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
