import { Briefcase, ShieldCheck, Eye, MessageSquare, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Buyer entry — deliberately NOT a pricing column.
 *
 * Buyers don't subscribe; they submit commercial requests that are governed by an
 * NDA / agreement gate. This block makes that workflow visible publicly and
 * routes into the real /auth flow with role pre-selected.
 */
export const BuyerEntry = () => (
  <section id="buyer" className="py-24 border-b border-border/40 relative overflow-hidden">
    <div className="absolute -top-32 right-0 w-[34rem] h-[34rem] rounded-full bg-accent/10 blur-[140px] pointer-events-none" />

    <div className="container relative">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              For acquisitions · OTT · distributors
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.95] tracking-tight text-4xl md:text-6xl mb-6">
            Buying or licensing?
            <br />
            <span className="gradient-text">Open a conversation, not a checkout.</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-xl mb-8">
            StreamVista's Buyer surface is a commercial workflow, not a subscription. Submit
            screener, rights and acquisition requests under an NDA gate, and track every reply,
            update and decision from one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/auth?intent=signup&role=buyer"
              className="cta-guide group h-12 inline-flex items-center justify-center gap-2 px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
            >
              <span>Join as Buyer</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/contact"
              className="h-12 inline-flex items-center justify-center gap-2 px-6 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
            >
              Talk to our team
            </Link>
          </div>
        </div>

        <ul className="grid sm:grid-cols-2 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
          {[
            {
              icon: Briefcase,
              title: "Submit a request",
              body: "Screener, rights enquiry, licensing scope, acquisition conversation — one secure intake form.",
            },
            {
              icon: ShieldCheck,
              title: "NDA gate up front",
              body: "Sensitive title information stays sealed until you accept the standing legal agreement.",
            },
            {
              icon: Eye,
              title: "Visible status",
              body: "Each request shows state and a timeline of updates from the StreamVista team and rights holders.",
            },
            {
              icon: MessageSquare,
              title: "Direct line",
              body: "Replies and admin notes are attached to the request — no fragmented email chains.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-card p-6">
              <Icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-display text-base font-bold mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);
