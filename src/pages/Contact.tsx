import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { useToast } from "@/hooks/use-toast";

/**
 * Contact form with topic routing.
 * `?topic=` from the query string is preserved in a visible selector AND
 * submitted as a hidden field, so leads route to the correct internal queue.
 */
const TOPICS = [
  { value: "general", label: "General enquiry", queue: "general" },
  { value: "buyer-access", label: "Buyer / marketplace access", queue: "buyer_ops" },
  { value: "partner", label: "Partner / distribution application", queue: "partnerships" },
  { value: "international-billing", label: "International billing & tax", queue: "finance" },
  { value: "ai-licensing", label: "AI licensing enquiry", queue: "licensing" },
  { value: "support", label: "Product support", queue: "support" },
] as const;

type TopicValue = (typeof TOPICS)[number]["value"];

const TOPIC_VALUES = TOPICS.map((t) => t.value) as [TopicValue, ...TopicValue[]];

const schema = z.object({
  topic: z.enum(TOPIC_VALUES),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  role: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please accept the privacy notice to continue." }),
  }),
});

const SUPPORT_EMAIL = "support@streamvista.in";
const RESPONSE_SLA = "We respond to most enquiries within 2 business days (Mon–Fri, IST).";

function normaliseTopic(raw: string | null): TopicValue {
  if (!raw) return "general";
  const hit = TOPICS.find((t) => t.value === raw);
  return (hit?.value ?? "general") as TopicValue;
}

export default function Contact() {
  const { toast } = useToast();
  const [params] = useSearchParams();

  const initialTopic = useMemo(() => normaliseTopic(params.get("topic")), [params]);

  const [form, setForm] = useState({
    topic: initialTopic as TopicValue,
    name: "",
    email: "",
    company: "",
    role: "",
    message: "",
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Keep topic in sync with URL, allow prefilling message/email via link.
  useEffect(() => {
    const message = params.get("message");
    const email = params.get("email");
    const topic = normaliseTopic(params.get("topic"));
    setForm((f) => ({
      ...f,
      topic,
      message: message ?? f.message,
      email: email ?? f.email,
    }));
  }, [params]);

  const onChange =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value =
        e.target instanceof HTMLInputElement && e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value;
      setForm((f) => ({ ...f, [k]: value as never }));
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const topicMeta =
        TOPICS.find((t) => t.value === parsed.data.topic) ?? TOPICS[0];
      const { error } = await supabase.from("contact_messages").insert({
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        role: parsed.data.role || null,
        message: parsed.data.message,
        user_id: user?.id ?? null,
        user_agent: navigator.userAgent.slice(0, 500),
        // Encode topic + routing queue into `source` until a dedicated column
        // is added; keeps schema untouched while enabling triage.
        source: `contact_form:${parsed.data.topic}:${topicMeta.queue}`,
      });
      if (error) throw error;

      // Best-effort admin notification via existing transactional email pipeline.
      const contactId = `${Date.now()}-${parsed.data.email}`;
      supabase.functions
        .invoke("send-transactional-email", {
          body: {
            templateName: "system-message-report",
            recipientEmail: SUPPORT_EMAIL,
            idempotencyKey: `contact-${contactId}`,
            templateData: {
              userEmail: parsed.data.email,
              userId: user?.id ?? "anonymous",
              severity: "info",
              title: `Contact · ${topicMeta.label} · ${parsed.data.name}`,
              message: parsed.data.message,
              context: [
                `Topic: ${topicMeta.label} (queue: ${topicMeta.queue})`,
                parsed.data.company ? `Company: ${parsed.data.company}` : null,
                parsed.data.role ? `Role: ${parsed.data.role}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              page: `/contact?topic=${parsed.data.topic}`,
              occurredAt: new Date().toISOString(),
            },
          },
        })
        .catch(() => {
          /* non-blocking */
        });
      setDone(true);
      setForm({
        topic: initialTopic,
        name: "",
        email: "",
        company: "",
        role: "",
        message: "",
        consent: false,
      });
      toast({
        title: "Message sent",
        description: `${topicMeta.label} · ${RESPONSE_SLA}`,
      });
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

  const activeTopic = TOPICS.find((t) => t.value === form.topic) ?? TOPICS[0];

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo
        title="Contact StreamVista Cloud X"
        description="Reach the StreamVista Cloud X team for partnerships, buyer access, licensing, billing, or product support."
        path="/contact"
      />

      <Navbar />

      <section className="container pt-32 pb-16 md:pt-40 md:pb-24 max-w-2xl">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-foreground mb-3">
          Get in touch
        </p>
        <h1 className="font-display font-black text-4xl md:text-5xl leading-[1.05] tracking-tight">
          Talk to the <span className="gradient-text">StreamVista</span> team.
        </h1>
        <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl">
          Pick a topic so your message reaches the right desk. {RESPONSE_SLA} For
          urgent issues, email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-foreground underline decoration-accent/70 underline-offset-2 hover:text-accent"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>

        {done ? (
          <div className="mt-10 rounded-2xl border border-accent/40 bg-accent/5 p-8">
            <h2 className="font-display text-xl font-bold">Thanks — your message is in.</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Routed to the <strong>{activeTopic.label}</strong> desk. {RESPONSE_SLA}
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
            <Field id="topic" label="Topic" required error={errors.topic}>
              <select
                id="topic"
                name="topic"
                value={form.topic}
                onChange={onChange("topic")}
                className={inputCls(errors.topic)}
              >
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input type="hidden" name="routing_queue" value={activeTopic.queue} readOnly />
            </Field>

            <Field id="name" label="Name" required error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={onChange("name")}
                autoComplete="name"
                required
                maxLength={120}
                className={inputCls(errors.name)}
              />
            </Field>

            <Field id="email" label="Email" required error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange("email")}
                autoComplete="email"
                required
                maxLength={255}
                className={inputCls(errors.email)}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field id="company" label="Company" error={errors.company}>
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={form.company}
                  onChange={onChange("company")}
                  autoComplete="organization"
                  maxLength={160}
                  className={inputCls(errors.company)}
                />
              </Field>

              <Field id="role" label="Role" error={errors.role}>
                <input
                  id="role"
                  name="role"
                  type="text"
                  value={form.role}
                  onChange={onChange("role")}
                  autoComplete="organization-title"
                  placeholder="Producer, Distributor, ..."
                  maxLength={80}
                  className={inputCls(errors.role)}
                />
              </Field>
            </div>

            <Field id="message" label="Message" required error={errors.message}>
              <textarea
                id="message"
                name="message"
                rows={6}
                value={form.message}
                onChange={onChange("message")}
                required
                maxLength={4000}
                className={inputCls(errors.message) + " resize-y min-h-[140px]"}
              />
            </Field>

            <div>
              <label
                htmlFor="consent"
                className="flex items-start gap-3 text-xs text-muted-foreground cursor-pointer select-none"
              >
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={onChange("consent")}
                  className="mt-[3px] h-4 w-4 rounded border-border/60 bg-secondary/30 text-accent focus:ring-accent/40"
                />
                <span>
                  I agree that StreamVista may store this message and reply by email in
                  line with the{" "}
                  <a
                    href="/privacy"
                    className="text-foreground underline decoration-accent/70 underline-offset-2 hover:text-accent"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {errors.consent && (
                <p className="mt-1.5 text-xs text-destructive">{errors.consent}</p>
              )}
            </div>

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
      <Footer />
    </main>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground mb-2"
      >
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
