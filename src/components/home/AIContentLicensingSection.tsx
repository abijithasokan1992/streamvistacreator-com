import { Link } from "react-router-dom";
import { Brain, ShieldCheck } from "lucide-react";

/**
 * "License Content for Responsible AI" — small professional band added under
 * Rights & Distribution on the public homepage. Does NOT replace the main
 * film-licensing message.
 *
 * Copy is deliberately non-committal: every opportunity is subject to
 * StreamVista rights verification, technical review and written authorization.
 */
export const AIContentLicensingSection = () => (
  <section
    id="ai-content-licensing"
    aria-labelledby="ai-content-licensing-heading"
    className="ai-band py-24 border-b border-border/40 relative overflow-hidden"
  >
    <div className="container relative">
      <div className="max-w-3xl animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-[hsl(198_88%_66%_/_0.7)]" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] ai-accent">
            AI Training &amp; Machine Learning
          </span>
        </div>
        <h2
          id="ai-content-licensing-heading"
          className="h-cine text-4xl md:text-5xl text-foreground"
        >
          License Content for{" "}
          <span className="ai-accent italic">Responsible AI</span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          StreamVista helps verified rights owners evaluate and license
          professionally produced audio-video content for approved AI and
          machine-learning use cases. Every opportunity remains subject to
          rights verification, technical review and written authorization.
        </p>

        <ul className="mt-6 grid gap-2 text-sm text-muted-foreground/90 max-w-xl">
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 ai-accent shrink-0" />
            No automatic approvals. Written authorization required from the
            rights holder.
          </li>
          <li className="flex items-start gap-2">
            <Brain className="w-4 h-4 mt-0.5 ai-accent shrink-0" />
            Model, output and retention terms recorded per licence.
          </li>
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/onboarding?intent=ai-licensing"
            className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            I Own Content
          </Link>
          <Link
            to="/contact?topic=ai-licensing-admin-review"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground hover:border-primary/50 transition-colors"
          >
            Enquire for AI Licensing
          </Link>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground/70 max-w-xl">
          StreamVista is a content aggregation, rights-verification and
          secure master licensing partner. We do not own third-party content
          and we do not claim AI-training rights unless the content owner
          grants those rights in writing, with full Chain of Title
          verification managed by StreamVista Operations.
        </p>
      </div>
    </div>
  </section>
);

export default AIContentLicensingSection;
