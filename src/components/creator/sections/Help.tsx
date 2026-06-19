import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, BookOpen, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function HelpSection() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!subject.trim() || !body.trim()) { toast.error("Subject and message are required."); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("support_requests").insert({
        user_id: user.id,
        category: "general",
        subject: subject.trim().slice(0, 200),
        message: body.trim().slice(0, 5000),
        status: "open",
      });
      if (error) throw error;
      toast.success("Ticket submitted. We'll reply by email.");
      setSubject(""); setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit ticket.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5" /> Support Contact</div>
          <p className="text-sm font-medium mt-2">support@crayonspictures.com</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="w-3.5 h-3.5" /> Documentation</div>
          <p className="text-sm font-medium mt-2">Coming soon.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><LifeBuoy className="w-4 h-4" /> Submit a ticket</div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          maxLength={200}
          className="mt-3 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="How can we help?"
          className="mt-2 w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="mt-3 inline-flex rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit Ticket"}
        </button>
      </div>
    </div>
  );
}
