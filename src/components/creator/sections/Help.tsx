import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, BookOpen, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CATEGORIES = [
  { value: "general",      label: "General question" },
  { value: "upload",       label: "Upload / storage issue" },
  { value: "title",        label: "Title or submission" },
  { value: "billing",      label: "Billing or invoice" },
  { value: "account",      label: "Account access" },
  { value: "bug",          label: "Bug report" },
  { value: "other",        label: "Other" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

export default function HelpSection() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!subject.trim() || !body.trim()) { toast.error("Subject and message are required."); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("support_requests").insert({
        user_id: user.id,
        request_type: category,
        subject: subject.trim().slice(0, 200),
        message: body.trim().slice(0, 5000),
        status: "open",
        metadata: {
          category,
          routed_inbox: "abijithasokan@crayonspictures.com",
          source: "creator_help",
          submitted_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
      setSubmitted(true);
      setSubject(""); setBody(""); setCategory("general");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit ticket.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
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
          <p className="text-sm font-semibold mt-2">Ticket submitted</p>
          <p className="text-xs text-muted-foreground mt-1">
            We'll reply by email to the address on your account.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-4 text-xs text-accent hover:underline"
          >
            Submit another ticket
          </button>
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
                placeholder="Share as much detail as you can — title IDs, error messages, what you were trying to do."
                className="mt-1.5 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-1 text-right">
                {body.length}/5000
              </p>
            </div>

            <button
              onClick={submit}
              disabled={busy}
              className="self-start inline-flex rounded-md bg-accent text-accent-foreground text-xs px-4 py-2 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit ticket"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
