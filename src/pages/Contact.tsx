import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  role: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
});

const Wordmark = () => (
  <div className="font-display font-black tracking-tight text-base md:text-lg uppercase">
    STREAMVISTA <span className="gradient-text">CLOUD X</span>
  </div>
);

export default function Contact() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const message = params.get("message");
    const email = params.get("email");
    if (message || email) {
      setForm((f) => ({
        ...f,
        message: message ?? f.message,
        email: email ?? f.email,
      }));
    }
  }, [params]);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v && v[0]) flat[k] = v[0];
      }
      setErrors(flat);
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("contact_messages").insert({
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        role: parsed.data.role || null,
        message: parsed.data.message,
        user_id: user?.id ?? null,
        user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;

      // Best-effort admin notification via existing transactional email pipeline.
      // Uses the generic system-message-report template so we do not add new templates.
      const contactId = `${Date.now()}-${parsed.data.email}`;
      supabase.functions
        .invoke("send-transactional-email", {
          body: {
            templateName: "system-message-report",
            recipientEmail: "abijithasokan@crayonspictures.com",
            idempotencyKey: `contact-${contactId}`,
            templateData: {
              userEmail: parsed.data.email,
              userId: user?.id ?? "anonymous",
              severity: "info",
              title: `Contact form · ${parsed.data.name}`,
              message: parsed.data.message,
              context: [
                parsed.data.company ? `Company: ${parsed.data.company}` : null,
                parsed.data.role ? `Role: ${parsed.data.role}` : null,
              ].filter(Boolean).join(" · "),
              page: "/contact",
              occurredAt: new Date().toISOString(),
            },
          },
        })
        .catch(() => { /* non-blocking */ });
      setDone(true);
      setForm({ name: "", email: "", company: "", role: "", message: "" });
      toast({ title: "Message sent", description: "Our team will reach out shortly." });
    } catch (err: any) {
      toast({
        title: "Could not send message",
        description: err?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo
        title="Contact Us · StreamVista Cloud X"
        description="Get in touch with the StreamVista Cloud X team for partnerships, support, and onboarding."
        path="/contact"
      />

      <header className="border-b border-border/40">
        <div className="container h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Wordmark />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </header>

      <section className="container py-16 md:py-24 max-w-2xl">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent mb-3">
          Get in touch
        </p>
        <h1 className="font-display font-black text-4xl md:text-5xl leading-[1.05] tracking-tight">
          Talk to the <span className="gradient-text">StreamVista</span> team.
        </h1>
        <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl">
          Tell us a little about your studio or project and we'll get back to you. We read every message.
        </p>

        {done ? (
          <div className="mt-10 rounded-2xl border border-accent/40 bg-accent/5 p-8">
            <h2 className="font-display text-xl font-bold">Thanks — your message is in.</h2>
            <p className="text-sm text-muted-foreground mt-2">
              We'll respond to <strong>{form.email || "your inbox"}</strong> shortly.
            </p>
            <button
              onClick={() => setDone(false)}
              className="mt-5 text-xs uppercase tracking-[0.18em] text-accent hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-5" noValidate>
            <Field id="name" label="Name" required error={errors.name}>
              <input
                id="name" type="text" value={form.name} onChange={onChange("name")}
                autoComplete="name" maxLength={120}
                className={inputCls(errors.name)}
              />
            </Field>

            <Field id="email" label="Email" required error={errors.email}>
              <input
                id="email" type="email" value={form.email} onChange={onChange("email")}
                autoComplete="email" maxLength={255}
                className={inputCls(errors.email)}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field id="company" label="Company" error={errors.company}>
                <input
                  id="company" type="text" value={form.company} onChange={onChange("company")}
                  autoComplete="organization" maxLength={160}
                  className={inputCls(errors.company)}
                />
              </Field>

              <Field id="role" label="Role" error={errors.role}>
                <input
                  id="role" type="text" value={form.role} onChange={onChange("role")}
                  placeholder="Producer, Distributor, ..." maxLength={80}
                  className={inputCls(errors.role)}
                />
              </Field>
            </div>

            <Field id="message" label="Message" required error={errors.message}>
              <textarea
                id="message" rows={6} value={form.message} onChange={onChange("message")}
                maxLength={4000}
                className={inputCls(errors.message) + " resize-y min-h-[140px]"}
              />
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="cta-guide group inline-flex items-center justify-center gap-2 h-12 px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md w-full sm:w-auto disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{submitting ? "Sending..." : "Send message"}</span>
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function Field({
  id, label, required, error, children,
}: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function inputCls(err?: string) {
  return [
    "w-full h-11 px-3.5 rounded-md bg-secondary/30 border text-sm text-foreground",
    "placeholder:text-muted-foreground",
    "focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition",
    err ? "border-destructive/60" : "border-border/60",
  ].join(" ");
}
