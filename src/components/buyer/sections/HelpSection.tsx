import { Link } from "react-router-dom";
import { Mail, BookOpen, HelpCircle, ArrowRight, MessagesSquare } from "lucide-react";

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How do commercial requests work?",
    a: "Every acquisition, licensing, screener and rights enquiry is reviewed by StreamVista admin before any title owner is contacted. You'll see the status change as it moves through review.",
  },
  {
    q: "Why can't I see full rights information on a title?",
    a: "Rights, territories and pricing are shared privately after admin verifies your enquiry. Submit a request to receive a scoped commercial packet for that title.",
  },
  {
    q: "How do screeners work?",
    a: "Approved screeners are watermarked and time-limited. Access is logged. You must accept the buyer confidentiality NDA before any screener is released.",
  },
  {
    q: "Where do I find delivery links?",
    a: "The Deliveries section lists every authorised package with its secure download link and expiry.",
  },
];

export default function HelpSection() {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-display text-xl">Help</h2>
        <p className="text-sm text-muted-foreground">Support, documentation and answers to common questions.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <HelpTile
          icon={Mail}
          title="Contact support"
          body="Talk to our team about a specific title, request or delivery."
          to="/contact"
        />
        <HelpTile
          icon={BookOpen}
          title="Documentation"
          body="Guides on how requests, screeners and deliveries work."
          to="/#platform"
          external
        />
        <HelpTile
          icon={MessagesSquare}
          title="Open a request"
          body="If you're unsure where to start, send a brief and we'll route it."
          to="/contact"
        />
      </div>

      <div className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-accent" aria-hidden />
          <h3 className="font-semibold text-sm">Frequently asked questions</h3>
        </div>
        <ul className="divide-y divide-border/40">
          {FAQS.map((f) => (
            <li key={f.q}>
              <details className="py-2.5 group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{f.q}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground transition group-open:rotate-90" aria-hidden />
                </summary>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HelpTile({
  icon: Icon, title, body, to, external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; body: string; to: string; external?: boolean;
}) {
  const inner = (
    <>
      <Icon className="w-4 h-4 text-accent" aria-hidden />
      <div className="text-sm font-semibold mt-2">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
    </>
  );
  const cls = "block rounded-xl border border-border/40 bg-secondary/10 p-4 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition";
  if (external) {
    return <a href={to} className={cls}>{inner}</a>;
  }
  return <Link to={to} className={cls}>{inner}</Link>;
}
