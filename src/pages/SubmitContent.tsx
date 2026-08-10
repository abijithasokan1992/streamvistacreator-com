import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackLifecycleEvent } from "@/lib/analytics/amplitude";

const schema = z.object({
  title: z.string().trim().min(1, "Content title is required").max(180),
  type: z.string().trim().min(1, "Content type is required").max(60),
  language: z.string().trim().min(1, "Language is required").max(80),
  duration: z.string().trim().min(1, "Duration is required").max(40),
  rightsOwner: z.string().trim().min(1, "Rights owner is required").max(120, "Rights owner must be under 120 characters"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .min(3, "Enter a valid email address")
    .max(254, "Email must be under 254 characters"),
  trailerLink: z.string().trim().url("Enter a valid trailer link").max(1000),
  posterLink: z.string().trim().url("Enter a valid poster link").max(1000),
  contactNumber: z.string().trim().min(7, "Enter a valid contact number").max(30),
});

type FormState = z.infer<typeof schema>;

const initialForm: FormState = {
  title: "",
  type: "",
  language: "",
  duration: "",
  rightsOwner: "",
  email: "",
  trailerLink: "",
  posterLink: "",
  contactNumber: "",
};

const inputClass =
  "h-12 w-full rounded-md border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function SubmitContent() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof FormState, string>> = {};
      for (const [key, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (messages?.[0]) nextErrors[key as keyof FormState] = messages[0];
      }
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const message = [
        `Content Title: ${parsed.data.title}`,
        `Type: ${parsed.data.type}`,
        `Language: ${parsed.data.language}`,
        `Duration: ${parsed.data.duration}`,
        `Rights Owner: ${parsed.data.rightsOwner}`,
        `Email: ${parsed.data.email}`,
        `Trailer Link: ${parsed.data.trailerLink}`,
        `Poster Link: ${parsed.data.posterLink}`,
        `Contact Number: ${parsed.data.contactNumber}`,
      ].join("\n");

      // Persist ONLY the real user-provided email. No synthetic/fabricated
      // fallback — an authenticated user without an email must supply one.
      const { data: authData } = await supabase.auth.getUser();
      const authedUserId = authData?.user?.id ?? null;

      const { error } = await supabase.from("contact_messages").insert({
        name: parsed.data.rightsOwner,
        email: parsed.data.email,
        company: null,
        role: "Content rights owner",
        message,
        source: "public_content_submission:whatsapp_onboarding",
        user_agent: navigator.userAgent.slice(0, 500),
        user_id: authedUserId,
      });

      if (error) throw error;

      // Track only after the commercial record has been persisted successfully.
      // No email, phone, title, rights-owner name, links, or legal material is sent.
      void trackLifecycleEvent("Content Submitted", {
        persona: "creator",
        content_type: parsed.data.type,
        source: "public_content_submission",
        rights_status: "claimed_owner_unverified",
        authenticated: Boolean(authedUserId),
        path: "/submit-content",
        submission_mode: "public_form",
      });

      supabase.functions
        .invoke("send-transactional-email", {
          body: {
            templateName: "system-message-report",
            recipientEmail: "support@streamvista.in",
            idempotencyKey: `content-submission-${Date.now()}`,
            templateData: {
              userEmail: parsed.data.email,
              userId: authedUserId ?? "anonymous",
              severity: "info",
              title: `New content submission · ${parsed.data.title}`,
              message,
              context: "Source: /submit-content",
              page: "/submit-content",
              occurredAt: new Date().toISOString(),
            },
          },
        })
        .catch(() => undefined);

      setSubmitted(true);
      setForm(initialForm);
      toast({ title: "Submission received", description: "StreamVista will contact you after review." });
    } catch (error: any) {
      const raw = error?.message ?? "Please try again.";
      toast({
        title: "Submission failed",
        description: raw,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="min-h-dvh bg-background text-foreground">
      <Seo
        title="Submit Your Content | StreamVista"
        description="Submit basic content metadata, trailer, poster and rights-owner contact details to StreamVista."
        path="/submit-content"
      />
      <Navbar />

      <section className="container max-w-xl pt-28 pb-16 md:pt-36 md:pb-24">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.28em] text-accent">
          Content onboarding
        </p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight md:text-5xl">
          Submit your content.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Basic details only. Trailer link and one poster are required.
        </p>

        {submitted ? (
          <div className="mt-9 rounded-2xl border border-primary/30 bg-primary/5 p-7">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-bold">Submission received</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Our onboarding team will review the content and contact the rights owner.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary hover:underline"
            >
              Submit another title
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-9 space-y-4">
            <Field label="Content Title" error={errors.title}>
              <input value={form.title} onChange={(e) => setField("title", e.target.value)} className={inputClass} maxLength={180} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" error={errors.type}>
                <select value={form.type} onChange={(e) => setField("type", e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  <option>Feature Film</option>
                  <option>Short Film</option>
                  <option>Series</option>
                  <option>Documentary</option>
                  <option>Music Video</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Language" error={errors.language}>
                <input value={form.language} onChange={(e) => setField("language", e.target.value)} className={inputClass} maxLength={80} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration" error={errors.duration}>
                <input value={form.duration} onChange={(e) => setField("duration", e.target.value)} placeholder="Example: 2h 10m" className={inputClass} maxLength={40} />
              </Field>
              <Field label="Contact Number" error={errors.contactNumber}>
                <input value={form.contactNumber} onChange={(e) => setField("contactNumber", e.target.value)} inputMode="tel" className={inputClass} maxLength={30} />
              </Field>
            </div>

            <Field label="Rights Owner" error={errors.rightsOwner}>
              <input value={form.rightsOwner} onChange={(e) => setField("rightsOwner", e.target.value)} className={inputClass} maxLength={120} />
            </Field>

            <Field label="Email" error={errors.email}>
              <input
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
                maxLength={255}
                required
              />
            </Field>

            <Field label="Trailer Link" error={errors.trailerLink}>
              <input value={form.trailerLink} onChange={(e) => setField("trailerLink", e.target.value)} type="url" placeholder="https://" className={inputClass} maxLength={1000} />
            </Field>

            <Field label="One Poster Link" error={errors.posterLink}>
              <input value={form.posterLink} onChange={(e) => setField("posterLink", e.target.value)} type="url" placeholder="Google Drive, Dropbox or public image link" className={inputClass} maxLength={1000} />
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-6 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit Content"}
            </button>
          </form>
        )}
      </section>

      <Footer />
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      <span>{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </label>
  );
}
