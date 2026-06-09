import { Quote, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  {
    quote: "We replaced three different tools — WeTransfer, Frame.io and a custom S3 setup — with StreamVista. Our editors actually use it.",
    author: "Production Lead",
    studio: "Crayons Pictures",
    accent: "from-primary to-primary-glow",
  },
  {
    quote: "The client review link is what closed it for us. My producer opened the link on his phone in a car and approved the cut in 4 minutes.",
    author: "Abhijith Asokan",
    studio: "Abhijith Asokan Productions",
    accent: "from-accent to-primary",
  },
  {
    quote: "UPI checkout, WhatsApp support, and storage priced for an Indian indie team. Finally a cloud that gets us.",
    author: "Independent Filmmaker",
    studio: "Kerala, India",
    accent: "from-primary-glow to-accent",
  },
];

const LOGO_NAMES = [
  "Crayons Pictures",
  "Abhijith Asokan Productions",
  "Crayons Bridge",
  "Crayons Loop",
  "Independent Network",
];

export const Testimonials = () => (
  <section id="testimonials" className="py-24 border-t border-border/40 relative overflow-hidden">
    <div className="absolute inset-0 grid-bg opacity-30" />
    <div className="container relative">
      {/* Logo bar */}
      <div className="flex flex-col items-center gap-6 mb-20 animate-fade-in">
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Trusted by film teams shipping right now
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {LOGO_NAMES.map((name) => (
            <div
              key={name}
              className="font-display text-sm md:text-base uppercase tracking-[0.18em] text-foreground/50 hover:text-foreground transition-colors"
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Section title */}
      <div className="text-center mb-14 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            What filmmakers say
          </span>
          <div className="w-8 h-px bg-accent" />
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Real cuts.
          <br />
          <span className="gradient-text">Real reviews.</span>
        </h2>
      </div>

      {/* Testimonial cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {TESTIMONIALS.map((t, i) => (
          <article
            key={t.author}
            className="group relative glass rounded-3xl p-7 flex flex-col gap-5 hover:border-accent/40 hover:-translate-y-1 transition-all animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={cn(
              "absolute -top-3 left-7 w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br shadow-lg",
              t.accent
            )}>
              <Quote className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex gap-0.5 mt-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="w-3.5 h-3.5 fill-accent text-accent" />
              ))}
            </div>
            <p className="text-sm md:text-base leading-relaxed text-foreground/90">
              "{t.quote}"
            </p>
            <div className="border-t border-border/60 pt-4 mt-auto">
              <div className="font-display font-bold text-sm">{t.author}</div>
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent mt-1">{t.studio}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
