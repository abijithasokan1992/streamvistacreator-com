import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut, Link2, Inbox, ShieldCheck, MessageSquareText, Play,
  CheckCircle2, Sparkles, ArrowRight, ArrowLeft, MailOpen, Clock, Eye, SkipForward,
  Film, Lock, ExternalLink,
} from "lucide-react";
import OnboardingCompleteBanner from "@/components/OnboardingCompleteBanner";
import FirstStepsCard from "@/components/dashboard/FirstStepsCard";
import { toast } from "sonner";

/**
 * Client review hub.
 * First-time visitors see a paginated 3-step wizard
 * (Wait for link → Review → Approve). Shown ONCE per browser,
 * dismissible via Skip Tour. Returning visitors land on the hub directly.
 */
const WIZARD_KEY = "sv_seen_client_wizard_v2";

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
    setStep(1);
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
            {showWizard ? (
              <button
                onClick={completeWizard}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider rounded-lg border border-accent/40 text-accent hover:bg-accent/10"
                aria-label="Skip tour and go to dashboard"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Skip Tour</span>
                <span className="sm:hidden">Skip</span>
              </button>
            ) : (
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
        <WizardView step={step} setStep={setStep} finish={completeWizard} />
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
const STEPS = [
  { n: 1 as const, label: "Wait for link" },
  { n: 2 as const, label: "Review" },
  { n: 3 as const, label: "Approve" },
];

function WizardView({
  step, setStep, finish,
}: {
  step: 1 | 2 | 3;
  setStep: (s: 1 | 2 | 3) => void;
  finish: () => void;
}) {
  const next = () => setStep(step === 1 ? 2 : 3);
  const back = () => setStep(step === 3 ? 2 : 1);

  return (
    <main className="container py-8 md:py-12 max-w-2xl">
      {/* Intro banner */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/40 bg-accent/5 mb-3">
          <Sparkles className="w-3 h-3 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Quick guide · 30 seconds</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          A 3-step walkthrough of how to use the <span className="text-foreground font-semibold">share link</span> your
          studio sends. No uploads here — you only watch, comment, and approve.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-7" aria-label={`Step ${step} of 3`}>
        {STEPS.map(({ n, label }) => {
          const state = n === step ? "active" : n < step ? "done" : "todo";
          return (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 h-9 rounded-full border text-[11px] font-mono-tech uppercase tracking-[0.18em] transition-all ${
                  state === "active"
                    ? "border-accent/60 bg-accent/10 text-accent glow-primary"
                    : state === "done"
                    ? "border-accent/30 bg-accent/5 text-accent/80"
                    : "border-border/50 text-muted-foreground/70"
                }`}
              >
                <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${
                  state === "done" ? "bg-accent text-background" : state === "active" ? "bg-gradient-primary text-primary-foreground" : "bg-border/40"
                }`}>
                  {state === "done" ? <CheckCircle2 className="w-3 h-3" /> : n}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {n < 3 && <div className={`h-px w-4 sm:w-6 ${n < step ? "bg-accent/50" : "bg-border/40"}`} />}
            </div>
          );
        })}
      </div>

      {step === 1 && <StepWaitForLink />}
      {step === 2 && <StepReview />}
      {step === 3 && <StepApprove />}

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
          onClick={finish}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <SkipForward className="w-3.5 h-3.5" /> Skip & go to dashboard
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
            Finish <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </main>
  );
}

/* ── Step cards ─────────────────────────────────────────── */
function StepShell({
  badge, icon: Icon, title, children,
}: { badge: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="relative glass-strong rounded-3xl p-7 md:p-9 overflow-hidden border border-border/40 animate-fade-in">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-accent/40 bg-accent/5">
          <Icon className="w-3 h-3 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">{badge}</span>
        </div>
        <h2 className="font-display text-2xl md:text-4xl font-black uppercase tracking-tight leading-[0.95] mb-4">
          {title}
        </h2>
        <div className="text-sm md:text-[15px] text-muted-foreground leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </section>
  );
}

function StepWaitForLink() {
  return (
    <StepShell badge="Step 1 of 3" icon={MailOpen} title={<>Your studio sends you a <span className="gradient-text">share link</span>.</> as any}>
      <p>
        Reviews always start <span className="text-foreground font-semibold">outside this app</span>. Your studio will
        send you a private link via <span className="text-accent">WhatsApp, email, or SMS</span> — something like{" "}
        <code className="text-accent">streamvistacreator.com/s/abc123</code>.
      </p>
      <p>
        When it arrives, just tap it. You'll land straight on the review player — no app to install, no account juggling.
      </p>
      <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3 mt-4">
        <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-foreground">Don't see a link yet?</div>
          <div className="text-muted-foreground">Skip the tour and ping your studio. They'll send one as soon as a cut is ready.</div>
        </div>
      </div>
    </StepShell>
  );
}

function StepReview() {
  return (
    <StepShell badge="Step 2 of 3" icon={MessageSquareText} title={<>Watch, then drop <span className="gradient-text">timecoded notes</span>.</> as any}>
      <p>
        The player is frame-accurate on phone, tablet, and desktop. Pause anywhere, type a note, and it gets pinned to
        that exact frame — your studio sees comments the moment you post them.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 pt-2">
        <Tile icon={Play} title="Cinematic player" body="Scrub, loop, fullscreen — all without losing quality." />
        <Tile icon={Eye} title="Watermarked preview" body="Your email may appear on-screen to keep the cut private." />
      </div>
    </StepShell>
  );
}

function StepApprove() {
  return (
    <StepShell badge="Step 3 of 3" icon={CheckCircle2} title={<>One click to <span className="gradient-text">approve the cut</span>.</> as any}>
      <p>
        When you're happy, hit <span className="text-accent font-semibold">Approve</span>. Your studio is notified
        instantly and the version is locked. Need changes? Leave notes instead and they'll send a new cut with a fresh link.
      </p>
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 mt-2">
        <div className="text-xs font-mono-tech uppercase tracking-[0.2em] text-accent mb-1">That's the whole flow</div>
        <div className="text-sm text-foreground">Wait for the link → review with notes → approve. You're ready.</div>
      </div>
    </StepShell>
  );
}

function Tile({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
      <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center mb-2 glow-primary">
        <Icon className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[12px] text-muted-foreground leading-relaxed">{body}</div>
    </div>
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

      {/* Incoming reviews — auto-listed shares addressed to this client's email */}
      <IncomingReviews />



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

/* ───────────────────────── Incoming reviews ───────────────────────── */
type IncomingReview = {
  id: string;
  filename: string;
  share_token: string;
  expires_at: string | null;
  revoked: boolean;
  has_password: boolean | null;
  view_only: boolean;
  created_at: string;
};

function IncomingReviews() {
  const navigate = useNavigate();
  const [items, setItems] = useState<IncomingReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("shared_files")
        .select("id,filename,share_token,expires_at,revoked,has_password,view_only,created_at")
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) { setItems([]); return; }
      const now = Date.now();
      const active = (data || []).filter(
        (r: any) => !r.expires_at || new Date(r.expires_at).getTime() > now,
      );
      setItems(active as IncomingReview[]);
    })();
    return () => { cancelled = true; };
  }, []);

  if (items === null) return null;
  if (items.length === 0) return null;

  return (
    <section className="glass-strong rounded-3xl p-6 md:p-7 border border-border/40 mb-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Incoming reviews</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{items.length} waiting</span>
      </div>
      <h2 className="font-display text-xl font-bold mb-1">Reviews sent directly to you</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Your studio addressed these share links to your email. Tap any one to open the review player.
      </p>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-background/40 hover:bg-background/70 hover:border-accent/40 transition p-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
              <Film className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{it.filename}</div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {it.expires_at
                    ? `Expires ${new Date(it.expires_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                    : "No expiry"}
                </span>
                {it.has_password && (
                  <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Password</span>
                )}
                {it.view_only && (
                  <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> View only</span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate(`/s/${it.share_token}`)}
              className="h-9 px-4 rounded-xl bg-gradient-primary text-primary-foreground text-xs font-semibold uppercase tracking-[0.18em] glow-primary inline-flex items-center gap-1.5"
            >
              Open <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
