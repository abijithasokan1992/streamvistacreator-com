import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LogOut, Link2, Inbox, ShieldCheck, MessageSquareText, Play,
  CheckCircle2, Sparkles, ArrowRight, Lock, Clock, Eye,
} from "lucide-react";
import OnboardingCompleteBanner from "@/components/OnboardingCompleteBanner";
import FirstStepsCard from "@/components/dashboard/FirstStepsCard";
import { toast } from "sonner";

/**
 * Client review hub — view-only.
 * Clients access content via signed share links (/s/:token).
 * This page guides them on how to review, leave timecoded notes, and approve cuts.
 */
export default function Client() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [linkInput, setLinkInput] = useState("");

  const openLink = () => {
    const raw = linkInput.trim();
    if (!raw) return toast.error("Paste the share link your studio sent you.");
    // Accept full URLs or /s/token or just a token.
    try {
      let token = raw;
      if (raw.startsWith("http")) {
        const u = new URL(raw);
        const m = u.pathname.match(/\/s\/([^/?#]+)/);
        if (m) token = m[1];
      } else if (raw.startsWith("/s/")) {
        token = raw.replace(/^\/s\//, "").split(/[?#]/)[0];
      }
      navigate(`/s/${token}`);
    } catch {
      toast.error("That doesn't look like a valid share link.");
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">Client Review Suite</div>
              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden sm:inline-flex px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">Site</Link>
            <button onClick={signOut} className="px-3 py-2 text-sm rounded-md border border-border/60 hover:bg-secondary inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container py-10 max-w-5xl">
        <OnboardingCompleteBanner />

        {/* Hero strip */}
        <section className="relative glass-strong rounded-3xl p-8 md:p-10 mb-8 overflow-hidden border border-border/40 animate-fade-in">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                Welcome to your private review suite
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-3">
              Watch. Comment.
              <br />
              <span className="gradient-text">Approve.</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              You're set up as a <span className="text-accent font-semibold">Client</span>. Open any share link your studio sends
              and review with frame-accurate notes — no software to install.
            </p>
          </div>
        </section>

        {user && <FirstStepsCard userId={user.id} variant="client" />}

        {/* Open-a-link panel */}
        <section className="glass-strong rounded-3xl p-6 md:p-7 border border-border/40 mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-4 h-4 text-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Open a review</span>
          </div>
          <h2 className="font-display text-xl font-bold mb-1">Paste your share link</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Drop in the full URL, the <code className="text-accent">/s/token</code> path, or just the token your studio sent.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openLink()}
              placeholder="https://streamvistacreator.com/s/abc123…"
              className="flex-1 h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm placeholder:text-muted-foreground/60 outline-none focus:border-accent/70 focus:bg-input/70"
            />
            <button
              onClick={openLink}
              className="cta-guide h-12 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary inline-flex items-center justify-center gap-2"
            >
              Open Review <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              How review works
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Play, title: "Cinematic player", body: "Frame-accurate scrubbing, loop, and full-screen review on any device." },
              { icon: MessageSquareText, title: "Timecoded notes", body: "Drop comments at exact frames. Your studio sees them in real time." },
              { icon: CheckCircle2, title: "One-click approval", body: "Sign off on a cut and your studio is notified instantly." },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className="glass rounded-2xl p-6 hover:border-accent/40 hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center mb-4 glow-primary">
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Safety strip */}
        <section className="grid sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: Lock, title: "Encrypted in transit", body: "Every byte protected by AES + TLS." },
            { icon: Clock, title: "Link expiry & limits", body: "Studios control how long you can access content." },
            { icon: Eye, title: "Watermarked previews", body: "Your email may be stamped on screens — anti-piracy by design." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/40 bg-background/40 p-4 flex gap-3">
              <Icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">{title}</div>
                <div className="text-[11px] text-muted-foreground">{body}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Upgrade hint */}
        <section className="glass rounded-2xl p-5 border border-border/40 flex items-start gap-3">
          <Inbox className="w-4 h-4 text-accent mt-0.5" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1">Need to upload your own assets?</div>
            <div className="text-sm text-muted-foreground">
              Ask your studio admin to upgrade your account to a Creator workspace.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
