import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LogOut, Link2, Inbox, ShieldCheck, MessageSquareText, Play,
  CheckCircle2, Sparkles, ArrowRight, ArrowLeft, Lock, Clock, Eye,
} from "lucide-react";
import OnboardingCompleteBanner from "@/components/OnboardingCompleteBanner";
import FirstStepsCard from "@/components/dashboard/FirstStepsCard";
import { toast } from "sonner";

/**
 * Client review hub.
 * First-time visitors see a 3-step wizard (Welcome → Open Link → How It Works).
 * Returning visitors land directly on the full hub.
 */
const WIZARD_KEY = "sv_seen_client_wizard_v1";

export default function Client() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [linkInput, setLinkInput] = useState("");
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  const [showWizard, setShowWizard] = useState<boolean>(() => {
    try { return localStorage.getItem(WIZARD_KEY) !== "1"; } catch { return true; }
  });
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const focusLinkInput = async () => {
    linkInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    linkInputRef.current?.focus();
    try {
      if (navigator.clipboard?.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text && /\/s\//.test(text)) {
          setLinkInput(text);
          toast.success("Link pasted from clipboard");
        }
      }
    } catch {}
  };

  const openLink = () => {
    const raw = linkInput.trim();
    if (!raw) return toast.error("Paste the share link your studio sent you.");
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

  const completeWizard = () => {
    try { localStorage.setItem(WIZARD_KEY, "1"); } catch {}
    setShowWizard(false);
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
            {!showWizard && (
              <button
                onClick={() => { setStep(1); setShowWizard(true); }}
                className="hidden sm:inline-flex px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Re-take tour
              </button>
            )}
            <Link to="/" className="hidden sm:inline-flex px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">Site</Link>
            <button onClick={signOut} className="px-3 py-2 text-sm rounded-md border border-border/60 hover:bg-secondary inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {showWizard ? (
        <WizardView
          step={step}
          setStep={setStep}
          linkInput={linkInput}
          setLinkInput={setLinkInput}
          openLink={openLink}
          finish={completeWizard}
        />
      ) : (
        <HubView
          user={user}
          linkInput={linkInput}
          setLinkInput={setLinkInput}
          openLink={openLink}
          focusLinkInput={focusLinkInput}
          linkInputRef={linkInputRef}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Wizard ───────────────────────── */
function WizardView({
  step, setStep, linkInput, setLinkInput, openLink, finish,
}: {
  step: 1 | 2 | 3;
  setStep: (s: 1 | 2 | 3) => void;
  linkInput: string;
  setLinkInput: (v: string) => void;
  openLink: () => void;
  finish: () => void;
}) {
  const next = () => setStep(step === 1 ? 2 : 3);
  const back = () => setStep(step === 3 ? 2 : 1);
  const totalSteps = 3;

  return (
    <main className="container py-10 max-w-2xl">
      {/* Progress */}
      <div className="flex items-center justify-center gap-3 mb-8" aria-label={`Step ${step} of ${totalSteps}`}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 rounded-full transition-all ${
              n === step ? "w-12 bg-gradient-primary glow-primary" : n < step ? "w-8 bg-accent/70" : "w-8 bg-border/60"
            }`}
          />
        ))}
        <span className="ml-3 text-[11px] font-mono-tech uppercase tracking-[0.25em] text-muted-foreground">
          Step {step} / {totalSteps}
        </span>
      </div>

      {step === 1 && <StepWelcome />}
      {step === 2 && <StepOpenReview linkInput={linkInput} setLinkInput={setLinkInput} openLink={openLink} />}
      {step === 3 && <StepHowItWorks />}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          onClick={back}
          disabled={step === 1}
          className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <button
          onClick={() => { try { localStorage.setItem(WIZARD_KEY, "1"); } catch {} finish(); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Skip tour
        </button>

        {step < 3 ? (
          <button
            onClick={next}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={finish}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary"
          >
            Enter Review Suite <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </main>
  );
}

const WIZARD_KEY = "sv_seen_client_wizard_v1";

function StepWelcome() {
  return (
    <section className="relative glass-strong rounded-3xl p-8 md:p-10 overflow-hidden border border-border/40 animate-fade-in">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="relative text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-accent/40 bg-accent/5">
          <Sparkles className="w-3 h-3 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Welcome</span>
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-4">
          Watch. Comment.
          <br />
          <span className="gradient-text">Approve.</span>
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          You're set up as a <span className="text-accent font-semibold">Client</span>. In 30 seconds we'll show you how
          to review your studio's work — no software to install.
        </p>
      </div>
    </section>
  );
}

function StepOpenReview({
  linkInput, setLinkInput, openLink,
}: { linkInput: string; setLinkInput: (v: string) => void; openLink: () => void }) {
  return (
    <section className="glass-strong rounded-3xl p-7 md:p-9 border border-border/40 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-4 h-4 text-accent" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Step 2 — Open a review</span>
      </div>
      <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">Paste the link your studio sent.</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Accepts the full URL, the <code className="text-accent">/s/token</code> path, or just the token. The link arrives
        directly from your studio via WhatsApp, email, or SMS — never from this page.
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
          className="h-12 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary inline-flex items-center justify-center gap-2"
        >
          Open Review <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground/70">
        No link yet? You can finish the tour and paste it later from the dashboard.
      </p>
    </section>
  );
}

function StepHowItWorks() {
  return (
    <section className="space-y-5 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-accent/40 bg-accent/5">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Step 3 — How it works</span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold">Three things you can do.</h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: Play, title: "Cinematic player", body: "Frame-accurate scrubbing & full-screen on any device." },
          { icon: MessageSquareText, title: "Timecoded notes", body: "Drop comments at exact frames; studio sees them live." },
          { icon: CheckCircle2, title: "One-click approval", body: "Sign off on a cut and your studio is notified instantly." },
        ].map(({ icon: Icon, title, body }) => (
          <article key={title} className="glass rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center mb-3 glow-primary">
              <Icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="font-display text-base font-bold mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
          </article>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: Lock, title: "Encrypted in transit", body: "Every byte protected by AES + TLS." },
          { icon: Clock, title: "Link expiry & limits", body: "Studios control how long you can access." },
          { icon: Eye, title: "Watermarked previews", body: "Your email may be stamped on screens." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border/40 bg-background/40 p-4 flex gap-3">
            <Icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider">{title}</div>
              <div className="text-[11px] text-muted-foreground">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Hub (post-wizard) ───────────────────────── */
function HubView({
  user, linkInput, setLinkInput, openLink, focusLinkInput, linkInputRef,
}: {
  user: any;
  linkInput: string;
  setLinkInput: (v: string) => void;
  openLink: () => void;
  focusLinkInput: () => void;
  linkInputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <main className="container py-10 max-w-5xl">
      <OnboardingCompleteBanner />

      {/* Hero strip */}
      <section className="relative glass-strong rounded-3xl p-8 md:p-10 mb-8 overflow-hidden border border-border/40 animate-fade-in">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Your private review suite</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-3">
            Watch. Comment.<br />
            <span className="gradient-text">Approve.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl">
            Open any share link your studio sends and review with frame-accurate notes.
          </p>
        </div>
      </section>

      {user && <FirstStepsCard userId={user.id} variant="client" onPasteLink={focusLinkInput} />}

      {/* Open-a-link panel */}
      <section className="glass-strong rounded-3xl p-6 md:p-7 border border-border/40 mb-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Open a review</span>
        </div>
        <h2 className="font-display text-xl font-bold mb-1">Got a share link from your studio?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Drop it in below. Accepts the full URL, the <code className="text-accent">/s/token</code> path, or just the token.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={linkInputRef}
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
  );
}
