import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Upload, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const schema = z.object({
  reporter_name: z.string().trim().min(1).max(200),
  reporter_email: z.string().trim().email().max(255),
  reporter_phone: z.string().trim().max(30).optional().or(z.literal("")),
  reporter_address: z.string().trim().max(500).optional().or(z.literal("")),
  copyright_work: z.string().trim().min(5).max(2000),
  infringing_url: z.string().trim().min(5).max(1000),
  description: z.string().trim().min(20).max(5000),
  signature: z.string().trim().min(2).max(200),
  good_faith_statement: z.literal(true),
  accuracy_statement: z.literal(true),
});

const MAX_FILE_MB = 10;

export const DMCAForm = () => {
  const [form, setForm] = useState({
    reporter_name: "", reporter_email: "", reporter_phone: "", reporter_address: "",
    copyright_work: "", infringing_url: "", description: "", signature: "",
    good_faith_statement: false, accuracy_statement: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Max ${MAX_FILE_MB}MB`); return; }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please complete all required fields");
      return;
    }
    setSubmitting(true);
    try {
      // Insert the DMCA row FIRST so we can bind any storage upload to its id.
      // Storage RLS on `dmca-evidence` requires the path's UUID prefix to match
      // an existing dmca_requests.id, which prevents anonymous uploads to
      // arbitrary UUID folders.
      const { data: inserted, error } = await supabase
        .from("dmca_requests")
        .insert({
          reporter_name: parsed.data.reporter_name,
          reporter_email: parsed.data.reporter_email,
          reporter_phone: form.reporter_phone || null,
          reporter_address: form.reporter_address || null,
          copyright_work: parsed.data.copyright_work,
          infringing_url: parsed.data.infringing_url,
          description: parsed.data.description,
          signature: parsed.data.signature,
          good_faith_statement: true,
          accuracy_statement: true,
          evidence_path: null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      if (file && inserted?.id) {
        const path = `${inserted.id}/${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("dmca-evidence")
          .upload(path, file, { upsert: false });
        // Non-fatal: the notice is already recorded. Surface a soft warning.
        if (upErr) {
          console.error("DMCA evidence upload failed", upErr);
          toast.error("Notice submitted, but evidence upload failed. Our team will follow up.");
        }
      }

      setDone(true);
      toast.success("Takedown notice submitted");

    } catch (err) {
      console.error("DMCA submission error", err);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="glass-strong rounded-3xl p-10 text-center animate-fade-in">
        <CheckCircle2 className="w-14 h-14 text-accent mx-auto mb-4" />
        <h3 className="font-display text-2xl font-bold mb-2">Notice received</h3>
        <p className="text-sm text-muted-foreground">Our DMCA agent will review and respond within 48 business hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-strong rounded-3xl p-6 md:p-10 space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Submit a Takedown Notice</h2>
        <p className="text-sm text-muted-foreground mt-1">All fields marked * are required.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Full name *"><Input value={form.reporter_name} onChange={e => set("reporter_name", e.target.value)} maxLength={200} required /></Field>
        <Field label="Email *"><Input type="email" value={form.reporter_email} onChange={e => set("reporter_email", e.target.value)} maxLength={255} required /></Field>
        <Field label="Phone"><Input value={form.reporter_phone} onChange={e => set("reporter_phone", e.target.value)} maxLength={30} /></Field>
        <Field label="Address"><Input value={form.reporter_address} onChange={e => set("reporter_address", e.target.value)} maxLength={500} /></Field>
      </div>

      <Field label="Copyrighted work being infringed *">
        <Textarea value={form.copyright_work} onChange={e => set("copyright_work", e.target.value)} maxLength={2000} rows={2} required />
      </Field>

      <Field label="URL / asset reference of infringing material on StreamVista Cloud X *">
        <Input value={form.infringing_url} onChange={e => set("infringing_url", e.target.value)} maxLength={1000} required placeholder="https://..." />
      </Field>

      <Field label="Description of the infringement *">
        <Textarea value={form.description} onChange={e => set("description", e.target.value)} maxLength={5000} rows={4} required />
      </Field>

      <div>
        <Label className="text-sm">Evidence file (optional, max {MAX_FILE_MB}MB)</Label>
        <label className="mt-2 flex items-center gap-3 cursor-pointer h-12 px-4 rounded-md border border-dashed border-border hover:border-accent transition-colors">
          <Upload className="w-4 h-4 text-accent" />
          <span className="text-sm text-muted-foreground truncate">{file ? file.name : "Choose a PDF, image, or document"}</span>
          <input type="file" className="hidden" onChange={onFile} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
        </label>
      </div>

      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={form.good_faith_statement} onChange={e => set("good_faith_statement", e.target.checked)} className="mt-1" required />
          <span className="text-muted-foreground">I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</span>
        </label>
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={form.accuracy_statement} onChange={e => set("accuracy_statement", e.target.checked)} className="mt-1" required />
          <span className="text-muted-foreground">The information in this notice is accurate, and under penalty of perjury, I am authorized to act on behalf of the rights-holder.</span>
        </label>
      </div>

      <Field label="Electronic signature (type full legal name) *">
        <Input value={form.signature} onChange={e => set("signature", e.target.value)} maxLength={200} required />
      </Field>

      <div className="rounded-xl border border-border/50 bg-background/40 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">What happens next</p>
        <p>We acknowledge receipt within 48 business hours. If the notice is valid, we disable access to the reported material and notify the uploader. The uploader may file a counter-notice if they believe the removal was a mistake.</p>
      </div>

      <button type="submit" disabled={submitting} className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary disabled:opacity-60 flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit Takedown Notice
      </button>
    </form>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    {children}
  </div>
);
