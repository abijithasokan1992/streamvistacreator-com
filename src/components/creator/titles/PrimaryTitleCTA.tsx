import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, ArrowRight, Send, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

/**
 * PrimaryTitleCTA — the single, context-aware first-title CTA.
 *
 *   no title       → “Create Your First Title”
 *   draft/incomplete → “Continue Your Title”
 *   changes_requested → “Continue Your Title”
 *   approved / ready_for_distribution / published → “Review & Submit” to next stage
 *   submitted / in_review / qc_review / legal_review / hold → “Track Review”
 *
 * This is the ONLY primary title CTA on the creator surface. All other
 * legacy “Add title” / “New title” buttons should be removed or hidden.
 */

type CTAState =
  | { kind: "none" }
  | { kind: "draft"; id: string }
  | { kind: "ready"; id: string }
  | { kind: "in_review"; id: string };

const READY_STATES  = new Set(["approved","ready_for_distribution","published","locked"]);
const REVIEW_STATES = new Set(["submitted","in_review","qc_review","legal_review","hold","changes_requested"]);
const DRAFT_STATES  = new Set(["draft","incomplete","rejected"]);

export function PrimaryTitleCTA({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<CTAState>({ kind: "none" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("content_titles")
        .select("id, status, updated_at")
        .eq("owner_user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setState({ kind: "none" });
      else if (DRAFT_STATES.has(data.status)) setState({ kind: "draft", id: data.id });
      else if (READY_STATES.has(data.status)) setState({ kind: "ready", id: data.id });
      else if (REVIEW_STATES.has(data.status)) setState({ kind: "in_review", id: data.id });
      else setState({ kind: "draft", id: data.id });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className={`h-11 w-56 rounded-md bg-muted/40 animate-pulse ${className}`} />;
  }

  const common = "gap-2 " + className;

  if (state.kind === "none") {
    return (
      <Button asChild size="lg" className={common}>
        <Link to="/creator?section=titles&new=1">
          <PlusCircle className="w-4 h-4" /> Create Your First Title
        </Link>
      </Button>
    );
  }
  if (state.kind === "draft") {
    return (
      <Button asChild size="lg" className={common}>
        <Link to={`/creator?section=titles&title=${state.id}`}>
          <ArrowRight className="w-4 h-4" /> Continue Your Title
        </Link>
      </Button>
    );
  }
  if (state.kind === "ready") {
    return (
      <Button asChild size="lg" className={common}>
        <Link to={`/creator?section=titles&title=${state.id}&submit=1`}>
          <Send className="w-4 h-4" /> Review &amp; Submit
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" variant="outline" className={common}>
      <Link to={`/creator?section=titles&title=${state.id}&track=1`}>
        <Clock className="w-4 h-4" /> Track Review
      </Link>
    </Button>
  );
}

export default PrimaryTitleCTA;
