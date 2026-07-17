import { Link } from "react-router-dom";
import { ReactNode } from "react";
import { Shield } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";

interface LegalLayoutProps {
  eyebrow?: string;
  title: string;
  updated?: string;
  children: ReactNode;
  /** Heading element to render the title as. Defaults to h1; pass "h2" when the page already has an h1 above this layout. */
  headingAs?: "h1" | "h2";
}

export const LegalLayout = ({ eyebrow = "Legal · Policy", title, updated, children, headingAs = "h1" }: LegalLayoutProps) => {
  const date =
    updated ??
    new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const HeadingTag = headingAs;

  return (
    <main className="min-h-dvh">
      <Navbar />
      <div className="container max-w-3xl pt-28 pb-20">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
        >
          ← Back to StreamVista Cloud X
        </Link>

        <header className="mt-8 mb-10">
          <div className="inline-flex items-center gap-2 mb-5 pill-attention">
            <Shield className="w-3.5 h-3.5" /> {eyebrow}
          </div>
          <HeadingTag className="font-display text-4xl md:text-6xl font-black tracking-tight mb-3 leading-[1.02]">
            {title}
          </HeadingTag>
          <p className="text-text-tertiary text-sm font-mono-tech uppercase tracking-[0.2em]">
            Last updated · {date}
          </p>
        </header>


        <article className="glass-strong rounded-3xl p-8 md:p-10 space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground">
          {children}
        </article>
      </div>
      <Footer />
    </main>
  );
};

export const LegalSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="font-display text-xl md:text-2xl text-foreground font-black tracking-tight mb-3 flex items-center gap-3">
      <span className="inline-block w-1 h-5 rounded-sm" style={{ background: "var(--gradient-primary)" }} />
      {title}
    </h2>
    <div className="space-y-2 text-text-secondary">{children}</div>
  </section>
);

