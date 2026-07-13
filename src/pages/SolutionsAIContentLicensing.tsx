import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const SUPPORTED_CONTENT = [
  "Feature films",
  "TV and streaming series",
  "Documentaries",
  "Advertisements",
  "Interviews",
  "News and broadcast content",
  "Panel discussions",
  "Professionally produced podcasts",
  "Premium licensed digital video",
];

const AI_USE_CASES = [
  "Facial-motion understanding",
  "Lip synchronization",
  "Mouth-movement prediction",
  "Visual-speech technologies",
  "Audio-video alignment research",
];

const TECHNICAL_REVIEW = [
  "Resolution",
  "Frame rate",
  "Audio-video synchronization",
  "Original master availability",
  "Encoding history",
  "Duration",
  "Language",
  "Subtitle / audio-track availability",
  "Technical defects",
  "Sample availability",
];

const RIGHTS_REVIEW = [
  "Chain of title",
  "Producer / content-owner authorization",
  "Performer and talent permissions",
  "Music rights",
  "Writer and director agreements where applicable",
  "Archive / stock-footage rights",
  "AI / ML training authorization",
  "Territory",
  "Licence term",
  "Exclusivity",
  "Permitted model and output use",
  "Data retention and deletion requirements",
];

const PROCESS = [
  "Submit catalogue",
  "Rights pre-screening",
  "Technical QC",
  "Buyer requirement matching",
  "Commercial negotiation",
  "Contract execution",
  "Secure delivery",
  "Usage and compliance record",
];

const requirementSchema = z.object({
  organization: z.string().trim().min(1).max(200),
  authorized_contact_name: z.string().trim().min(1).max(200),
  authorized_contact_email: z.string().trim().email().max(255),
  intended_ai_use_case: z.string().trim().min(1).max(2000),
  content_types: z.string().trim().max(1000).optional().default(""),
  languages: z.string().trim().max(500).optional().default(""),
  required_hours: z.string().trim().max(50).optional().default(""),
  resolution: z.string().trim().max(100).optional().default(""),
  audio_specs: z.string().trim().max(500).optional().default(""),
  licence_term: z.string().trim().max(200).optional().default(""),
  territories: z.string().trim().max(500).optional().default(""),
  model_training_purpose: z.string().trim().max(2000).optional().default(""),
  commercial_or_research: z.enum(["commercial", "research", "both", "unspecified"]).default("unspecified"),
  derived_output_requirements: z.string().trim().max(2000).optional().default(""),
  data_retention: z.string().trim().max(500).optional().default(""),
  deletion_requirements: z.string().trim().max(500).optional().default(""),
  security_requirements: z.string().trim().max(1000).optional().default(""),
  prohibited_content: z.string().trim().max(1000).optional().default(""),
  target_budget: z.string().trim().max(200).optional().default(""),
});

const Section = ({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="py-16 border-b border-border/40">
    <div className="container max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-px bg-accent" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">{eyebrow}</span>
      </div>
      <h2 className="font-display font-black uppercase leading-[0.95] tracking-tight text-3xl md:text-4xl mb-6">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-4">{children}</div>
    </div>
  </section>
);

const List = ({ items }: { items: string[] }) => (
  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-2">
    {items.map((it) => (
      <li key={it} className="flex items-start gap-2 text-sm">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

function BuyerRequirementForm() {
  const [state, setState] = useState({
    organization: "",
    authorized_contact_name: "",
    authorized_contact_email: "",
    intended_ai_use_case: "",
    content_types: "",
    languages: "",
    required_hours: "",
    resolution: "",
    audio_specs: "",
    licence_term: "",
    territories: "",
    model_training_purpose: "",
    commercial_or_research: "unspecified" as "commercial" | "research" | "both" | "unspecified",
    derived_output_requirements: "",
    data_retention: "",
    deletion_requirements: "",
    security_requirements: "",
    prohibited_content: "",
    target_budget: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onChange = (k: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = requirementSchema.safeParse(state);
    if (!parsed.success) {
      toast({ title: "Please complete required fields", description: "Organization, contact name, email and intended AI use case are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("submit-ai-buyer-requirement", { body: parsed.data });
      if (error) throw error;
      setDone(true);
      toast({ title: "Request received", description: "StreamVista will review your requirement and follow up from a verified email." });
    } catch (err) {
      toast({ title: "Could not submit", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
        <h3 className="font-display text-xl font-bold mb-2">Request received</h3>
        <p className="text-muted-foreground text-sm">
          Thank you. A StreamVista licensing lead will review your requirement and follow up. Access to content is only granted after
          StreamVista approval and contract execution.
        </p>
      </div>
    );
  }

  const Field = ({ label, k, required, textarea, type = "text" }: { label: string; k: keyof typeof state; required?: boolean; textarea?: boolean; type?: string }) => (
    <label className="block">
      <span className="text-[11px] font-mono-tech uppercase tracking-[0.2em] text-foreground/80">{label}{required ? " *" : ""}</span>
      {textarea ? (
        <textarea
          value={state[k] as string}
          onChange={onChange(k)}
          rows={3}
          className="mt-1.5 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm"
          required={required}
        />
      ) : (
        <input
          type={type}
          value={state[k] as string}
          onChange={onChange(k)}
          className="mt-1.5 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm"
          required={required}
        />
      )}
    </label>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border/50 bg-card/40 p-6 md:p-8 space-y-5">
      <p className="text-xs text-muted-foreground">
        Submissions are reviewed internally. StreamVista does not share content, samples or masters before contract approval.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Organization" k="organization" required />
        <Field label="Authorized contact" k="authorized_contact_name" required />
        <Field label="Contact email" k="authorized_contact_email" required type="email" />
        <Field label="Required hours" k="required_hours" />
        <Field label="Content types (comma separated)" k="content_types" />
        <Field label="Languages" k="languages" />
        <Field label="Resolution" k="resolution" />
        <Field label="Audio specifications" k="audio_specs" />
        <Field label="Licence term" k="licence_term" />
        <Field label="Territories" k="territories" />
        <Field label="Target budget / pricing model" k="target_budget" />
        <label className="block">
          <span className="text-[11px] font-mono-tech uppercase tracking-[0.2em] text-foreground/80">Commercial / research</span>
          <select
            value={state.commercial_or_research}
            onChange={onChange("commercial_or_research")}
            className="mt-1.5 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm"
          >
            <option value="unspecified">Unspecified</option>
            <option value="commercial">Commercial</option>
            <option value="research">Research</option>
            <option value="both">Both</option>
          </select>
        </label>
      </div>
      <Field label="Intended AI use case" k="intended_ai_use_case" required textarea />
      <Field label="Model-training purpose" k="model_training_purpose" textarea />
      <Field label="Derived-output requirements" k="derived_output_requirements" textarea />
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Data retention" k="data_retention" textarea />
        <Field label="Deletion requirements" k="deletion_requirements" textarea />
        <Field label="Security requirements" k="security_requirements" textarea />
        <Field label="Prohibited content" k="prohibited_content" textarea />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit requirement
      </button>
    </form>
  );
}

const SolutionsAIContentLicensing = () => (
  <main className="min-h-dvh home-serif">
    <Seo
      title="AI Training Content Licensing — StreamVista"
      description="License rights-verified, professionally produced audio-video content for approved AI and machine-learning use cases. Rights verification, technical QC, and written authorization required."
      path="/solutions/ai-content-licensing"
    />
    <Navbar />

    <header className="pt-24 pb-16 border-b border-border/40">
      <div className="container max-w-5xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Solutions · AI Content Licensing</span>
        </div>
        <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl mb-6">
          Rights-verified content for <span className="gradient-text">Responsible AI</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Professionally recorded, rights-verified audio-video content for approved AI and machine-learning projects.
          Every opportunity is subject to rights verification, technical review and written authorization.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/onboarding?intent=ai-licensing" className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Submit Licensed Content
          </Link>
          <a href="#request" className="inline-flex items-center rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-primary/50">
            Request Content Availability
          </a>
        </div>
      </div>
    </header>

    <Section eyebrow="Supported content" title="What we license">
      <List items={SUPPORTED_CONTENT} />
    </Section>

    <Section eyebrow="Potential AI use cases" title="Use cases we evaluate">
      <List items={AI_USE_CASES} />
      <p className="text-xs text-muted-foreground/80 mt-4">
        Every use case requires separate written authorization from the rights holder.
      </p>
    </Section>

    <Section eyebrow="Technical review" title="What we check technically">
      <List items={TECHNICAL_REVIEW} />
    </Section>

    <Section eyebrow="Rights review" title="What we verify on rights">
      <List items={RIGHTS_REVIEW} />
    </Section>

    <Section eyebrow="Process" title="How a licence is executed">
      <ol className="mt-2 space-y-2 text-sm">
        {PROCESS.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="font-mono-tech text-accent text-[11px] w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </Section>

    <Section id="request" eyebrow="Request an AI dataset" title="Tell us what you need">
      <BuyerRequirementForm />
    </Section>

    <Footer />
  </main>
);

export default SolutionsAIContentLicensing;
