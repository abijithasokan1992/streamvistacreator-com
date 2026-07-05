import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Search, Loader2, ExternalLink, Save, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Category =
  | "production_company"
  | "distributor"
  | "ott"
  | "broadcaster"
  | "festival"
  | "market"
  | "studio";

const CATEGORIES: Array<{ id: Category; label: string; hint: string }> = [
  { id: "production_company", label: "Production companies", hint: "e.g. Dharma Productions" },
  { id: "distributor", label: "Distributors", hint: "e.g. Sony Pictures India" },
  { id: "ott", label: "OTT platforms", hint: "e.g. Netflix India" },
  { id: "broadcaster", label: "Broadcasters", hint: "e.g. Star India" },
  { id: "festival", label: "Festivals", hint: "e.g. Cannes 2026" },
  { id: "market", label: "Markets", hint: "e.g. Marché du Film" },
  { id: "studio", label: "Post-production studios", hint: "e.g. Prime Focus" },
];

type ResearchResult = { title: string; url?: string; description?: string };

export default function AdminResearch() {
  const { user, isAdmin, loading } = useAuth();
  const [category, setCategory] = useState<Category>("production_company");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ResearchResult[] | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("research-firecrawl", {
        body: { category, query: query.trim(), limit: 10 },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error === "firecrawl_not_connected") {
        toast.error("Firecrawl is not connected. Link it in Settings → Integrations.");
        return;
      }
      setResults(((data as { results?: ResearchResult[] })?.results) ?? []);
    } catch (e) {
      toast.error(`Research failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.id === category)!;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <header>
          <Link
            to="/admin/integrations"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to integrations
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">Research Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Powered by Firecrawl. Nothing is saved automatically — every result must be reviewed
            before you copy it into a production, contact, or CRM entry.
          </p>
        </header>

        <div className="glass rounded-2xl p-5 space-y-4 border border-border/50">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  category === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 hover:bg-secondary text-foreground border-border/60"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeCat.hint}
              onKeyDown={(e) => e.key === "Enter" && run()}
              disabled={busy}
            />
            <Button onClick={run} disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Research</span>
            </Button>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Results are ephemeral. Use "Mark for review" to flag items you want to import later
              via the existing Production, Buyer, or Contact modules. Metadata is never duplicated.
            </span>
          </div>
        </div>

        {results && results.length === 0 && (
          <div className="text-sm text-muted-foreground">No results. Try a different query.</div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => {
              const key = `${r.url ?? r.title}-${i}`;
              const isSaved = saved.has(key);
              return (
                <div
                  key={key}
                  className="glass rounded-xl p-4 border border-border/50 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {activeCat.label}
                      </Badge>
                    </div>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                        {r.description}
                      </p>
                    )}
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-2"
                      >
                        {r.url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isSaved ? "secondary" : "outline"}
                    onClick={() => {
                      const next = new Set(saved);
                      if (isSaved) next.delete(key);
                      else {
                        next.add(key);
                        toast.success("Marked for review. Copy into the relevant module manually.");
                      }
                      setSaved(next);
                    }}
                    className="h-8 text-xs shrink-0"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {isSaved ? "Marked" : "Mark for review"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
