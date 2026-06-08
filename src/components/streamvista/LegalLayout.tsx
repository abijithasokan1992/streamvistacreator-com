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
}

export const LegalLayout = ({ eyebrow = "Legal · Policy", title, updated, children }: LegalLayoutProps) => {
  const date =
    updated ??
    new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-[0.2em] text-accent mb-5">
            <Shield className="w-3.5 h-3.5" /> {eyebrow}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">{title}</h1>
          <p className="text-muted-foreground text-sm">Last updated: {date}</p>
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
    <h2 className="font-display text-xl text-foreground font-bold mb-3">{title}</h2>
    <div className="space-y-2">{children}</div>
  </section>
);
