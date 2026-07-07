import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LifeBuoy, BookOpen, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";

const CATEGORIES = [
  { value: "general",      label: "General question",       team: "support"  },
  { value: "upload",       label: "Upload / storage issue", team: "ops"      },
  { value: "title",        label: "Title or submission",    team: "review"   },
  { value: "billing",      label: "Billing or invoice",     team: "billing"  },
  { value: "account",      label: "Account access",         team: "support"  },
  { value: "bug",          label: "Bug report",             team: "eng"      },
  { value: "other",        label: "Other",                  team: "support"  },
] as const;

type Category = typeof CATEGORIES[number]["value"];

// Map free-form UI category → allowed DB request_type
// (support_requests.request_type CHECK: support|service|archival|upgrade|plan_upgrade|other)
const CATEGORY_TO_REQUEST_TYPE: Record<Category, "support" | "service" | "upgrade" | "other"> = {
  general: "support",
  upload:  "service",
  title:   "support",
  billing: "upgrade",
  account: "support",
  bug:     "other",
  other:   "other",
};

type ErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "WORKSPACE_NOT_FOUND"
  | "RLS_DENIED"
  | "DATABASE_ERROR"
  | "SERVER_ERROR";

function classifyError(err: { code?: string; message?: string } | null | undefined): { code: ErrorCode; message: string } {
  const raw = (err?.message ?? "").toLowerCase();
  const pgCode = err?.code ?? "";
  if (!err) return { code: "SERVER_ERROR", message: "Unknown error." };
  if (pgCode === "42501" || raw.includes("row-level security") || raw.includes("permission denied")) {
    return { code: "RLS_DENIED", message: "You don't have permission to submit tickets. Please sign in again." };
  }
  if (pgCode === "23514" || raw.includes("violates check constraint")) {
    return { code: "VALIDATION_ERROR", message: "One of the fields has an invalid value. Please review and try again." };
  }
  if (pgCode === "23502" || raw.includes("not-null") || raw.includes("null value")) {
    return { code: "VALIDATION_ERROR", message: "A required field is missing." };
  }
  if (pgCode === "23503" || raw.includes("foreign key")) {
    return { code: "DATABASE_ERROR", message: "Related record not found. Please refresh and try again." };
  }
  if (pgCode.startsWith("23")) return { code: "DATABASE_ERROR", message: err.message ?? "Database error." };
  return { code: "SERVER_ERROR", message: err.message ?? "Unexpected error." };
}

export default function HelpSection() {
  const { user } = useAuth();
  const { active: activeWorkspace } = useWorkspaces();
  const [category, setCategory] = useState<Category>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; ref: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    setErrorMsg(null);

    if (!user) {
      setErrorMsg("You must be signed in to submit a ticket.");
      toast.error("Sign in required.");
      return;
    }

    const s = subject.trim();
    const m = body.trim();
    if (!s) { setErrorMsg("Subject is required."); return; }
    if (!m) { setErrorMsg("Message is required."); return; }

    const catDef = CATEGORIES.find(c => c.value === category)!;
    const requestType = CATEGORY_TO_REQUEST_TYPE[category];

    setBusy(true);
    try {
      const payload = {
        user_id: user.id,
        request_type: requestType,
        subject: s.slice(0, 200),
        message: m.slice(0, 5000),
        status: "open" as const,
        metadata: {
          category,
          category_label: catDef.label,
          assigned_team: catDef.team,
          priority: "normal",
          workspace_id: activeWorkspace?.id ?? null,
          workspace_name: activeWorkspace?.name ?? null,
          user_email: user.email ?? null,
          routed_inbox: "abijithasokan@crayonspictures.com",
          source: "creator_help",
          submitted_at: new Date().toISOString(),
        },
      };

      const { data, error } = await (supabase as any)
        .from("support_requests")
        .insert(payload)
        .select("id, created_at")
        .single();

      if (error) {
        console.error("[support-ticket] insert failed", {
          code: error.code, message: error.message, details: error.details, hint: error.hint,
          user_id: user.id, workspace_id: activeWorkspace?.id ?? null,
        });
        // Best-effort audit log for the failure (ignored if RLS blocks)
        try {
          await (supabase as any).from("support_requests").insert({
            user_id: user.id,
            request_type: "other",
            subject: "[audit] ticket submission failed",
            message: `code=${error.code ?? ""} msg=${error.message ?? ""}`,
            status: "open",
            metadata: {
              source: "creator_help_audit",
              failed_payload: { ...payload, message: "[redacted]" },
              db_error: { code: error.code, message: error.message, details: error.details, hint: error.hint },
              timestamp: new Date().toISOString(),
            },
          });
        } catch { /* swallow */ }

        const c = classifyError(error);
        setErrorMsg(`${c.code}: ${c.message}`);
        toast.error(c.message);
        return;
      }

      const shortRef = `ST-${(data?.id ?? "").toString().slice(0, 8).toUpperCase()}`;
      setSubmitted({ id: data?.id, ref: shortRef });
      setSubject(""); setBody(""); setCategory("general");
      toast.success("Ticket submitted successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error.";
      console.error("[support-ticket] unexpected", e);
      setErrorMsg(`SERVER_ERROR: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/40 bg-secondary/5 px-4 py-3 text-[11px] text-muted-foreground">
        Free creators can submit tickets and we'll do our best to respond. Paid / managed plans receive priority handling
        and faster turnaround — free-tier requests follow standard response times.
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3.5 h-3.5" /> Support email
          </div>
          <p className="text-sm font-medium mt-2">support@crayonspictures.com</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Typical reply within one business day.
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5" /> Guides
          </div>
          <p className="text-sm font-medium mt-2">Click "Guide" in the header for quick answers.</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Covers uploads, metadata, submissions and upgrades.
          </p>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold mt-2">✓ Ticket submitted successfully.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Reference: <span className="font-mono">{submitted.ref}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            We'll reply by email to the address on your account.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Link
              to="/dashboard/notifications"
              className="text-xs rounded-md border border-border/50 px-3 py-1.5 hover:border-accent/50"
            >
              View My Tickets
            </Link>
            <button
              onClick={() => setSubmitted(null)}
              className="text-xs rounded-md bg-accent text-accent-foreground px-3 py-1.5"
            >
              Submit Another
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5 md:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="w-4 h-4" /> Submit a ticket
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a category so we can route your request to the right team.
          </p>

          <div className="grid gap-4 mt-5">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-1.5 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
                disabled={busy}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Briefly describe your issue"
                maxLength={200}
                disabled={busy}
                className="mt-1.5 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={5000}
                disabled={busy}
                placeholder="Share as much detail as you can — title IDs, error messages, what you were trying to do."
                className="mt-1.5 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-1 text-right">
                {body.length}/5000
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="self-start inline-flex rounded-md bg-accent text-accent-foreground text-xs px-4 py-2 disabled:opacity-50"
            >
              {busy ? "Submitting ticket…" : "Submit ticket"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
