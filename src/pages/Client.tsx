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
        <SandboxView finish={completeWizard} />
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

/* ───────────────────────── Sandbox activation panel ───────────────────────── */
function playTempleBell() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2);
  } catch {}
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

type PayPhase = "idle" | "loading_sdk" | "creating_order" | "awaiting_user" | "verifying" | "success" | "error";
type PayErrorKind = "sdk" | "order" | "payment" | "verify" | "network";

const SUPPORT_EMAIL = "support@streamvistacreator.com";

function SandboxView({ finish }: { finish: () => void }) {
  const [phase, setPhase] = useState<PayPhase>("idle");
  const [errorKind, setErrorKind] = useState<PayErrorKind | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const busy =
    phase === "loading_sdk" ||
    phase === "creating_order" ||
    phase === "awaiting_user" ||
    phase === "verifying";

  const failWith = (kind: PayErrorKind, msg: string, paymentId?: string | null) => {
    setErrorKind(kind);
    setErrorMsg(msg);
    setPhase("error");
    if (paymentId !== undefined) setLastPaymentId(paymentId);
    toast.error(msg);
  };

  const activate = async () => {
    if (busy) return;
    playTempleBell();
    setAttempts((n) => n + 1);
    setErrorKind(null);
    setErrorMsg("");
    setLastPaymentId(null);
    setPhase("loading_sdk");

    try {
      await loadRazorpayScript();
    } catch {
      return failWith("sdk", "Razorpay checkout failed to load. Check your network and retry.");
    }

    setPhase("creating_order");
    toast.loading("Provisioning Nilavara A sandbox…", { id: "sbx" });
    let createRes;
    try {
      createRes = await supabase.functions.invoke("fastlink-pay", {
        body: { action: "create" },
      });
    } catch (e) {
      toast.dismiss("sbx");
      return failWith("network", e instanceof Error ? e.message : "Network error while creating order.");
    }
    toast.dismiss("sbx");
    const { data, error } = createRes;
    if (error || !data?.orderId) {
      return failWith("order", error?.message || "Could not start verification. Please retry.");
    }

    let userEmail: string | undefined;
    try {
      const { data: u } = await supabase.auth.getUser();
      userEmail = u?.user?.email ?? undefined;
    } catch {}

    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
      return failWith("sdk", "Razorpay SDK unavailable. Reload the page and try again.");
    }

    setPhase("awaiting_user");

    const rzp = new Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: data.currency,
      name: "StreamVista · Kammattam",
      description: "Workspace Node Verification",
      prefill: { email: userEmail },
      theme: { color: "#f59e0b" },
      handler: async (resp: any) => {
        setPhase("verifying");
        setLastPaymentId(resp?.razorpay_payment_id ?? null);
        toast.loading("Verifying activation…", { id: "sbv" });
        let verifyRes;
        try {
          verifyRes = await supabase.functions.invoke("fastlink-pay", {
            body: {
              action: "verify",
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
        } catch (e) {
          toast.dismiss("sbv");
          return failWith(
            "verify",
            e instanceof Error ? e.message : "Network error while verifying payment.",
            resp?.razorpay_payment_id ?? null,
          );
        }
        toast.dismiss("sbv");
        const { data: v, error: vErr } = verifyRes;
        if (vErr || !v?.verified) {
          return failWith(
            "verify",
            vErr?.message || "We couldn't verify your payment. If you were charged, contact support.",
            resp?.razorpay_payment_id ?? null,
          );
        }
        setPhase("success");
        toast.success("Workspace node activated.");
        finish();
      },
      modal: {
        ondismiss: () => {
          // Only treat as error if we hadn't progressed past awaiting_user
          setPhase((cur) => {
            if (cur === "awaiting_user") {
              toast.message("Checkout closed — you can retry anytime.");
              return "idle";
            }
            return cur;
          });
        },
      },
    });

    rzp.on("payment.failed", (resp: any) => {
      const reason =
        resp?.error?.description ||
        resp?.error?.reason ||
        "Payment failed. Please try a different card or method.";
      failWith("payment", reason, resp?.error?.metadata?.payment_id ?? null);
    });

    try {
      rzp.open();
    } catch (e) {
      failWith("sdk", e instanceof Error ? e.message : "Could not open Razorpay checkout.");
    }
  };

  const requestFreshVerification = async () => {
    toast.loading("Requesting a fresh verification order…", { id: "fresh" });
    setLastPaymentId(null);
    setErrorKind(null);
    setErrorMsg("");
    // A fresh activate() call creates a brand-new Razorpay order on the server.
    await activate();
    toast.dismiss("fresh");
  };

  const mailtoSupport = () => {
    const subject = encodeURIComponent("Workspace Node ₹1 verification issue");
    const body = encodeURIComponent(
      [
        "Hi StreamVista support,",
        "",
        "My ₹1 workspace verification didn't go through.",
        `Attempts: ${attempts}`,
        `Last error: ${errorKind ?? "n/a"} — ${errorMsg || "n/a"}`,
        `Razorpay payment id: ${lastPaymentId ?? "n/a"}`,
        "",
        "Please help reconcile or refund.",
      ].join("\n"),
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const phaseLabel: Record<PayPhase, string> = {
    idle: "Activate Workspace Node (₹1 Verification)",
    loading_sdk: "Loading checkout…",
    creating_order: "Provisioning sandbox…",
    awaiting_user: "Waiting for payment…",
    verifying: "Verifying payment…",
    success: "Activated",
    error: "Retry Activation",
  };

  return (
    <main className="container py-10 md:py-14 max-w-2xl">
      <div className="bg-zinc-950 border border-zinc-800 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 text-center animate-fade-in">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest">
            Kammattam Sandbox Node
          </span>
          <h3 className="text-xl md:text-2xl font-black text-white">
            No Project Link From Studio Yet?
          </h3>
          <p className="text-xs md:text-sm text-zinc-400 max-w-sm mx-auto">
            Don't sit tight waiting. Deploy your localized free pipeline inside Nilavara A and
            experience the full-fidelity review matrix instantly.
          </p>
        </div>

        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left font-mono text-xs text-zinc-400 space-y-1">
          <p><strong className="text-zinc-200">Vault:</strong> Nilavara A (Free Allocation Tier)</p>
          <p><strong className="text-zinc-200">Provision Cost:</strong> ₹1 Integration Charge (Refundable verification setup)</p>
        </div>

        {phase === "error" && (
          <div
            role="alert"
            className="text-left p-4 bg-red-950/40 border border-red-900/60 rounded-xl space-y-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-mono font-bold text-red-300 uppercase tracking-widest">
                  {errorKind === "payment" && "Payment failed"}
                  {errorKind === "verify" && "Verification failed"}
                  {errorKind === "order" && "Couldn't start order"}
                  {errorKind === "sdk" && "Checkout unavailable"}
                  {errorKind === "network" && "Network error"}
                </p>
                <p className="text-xs text-red-200/90 leading-relaxed">{errorMsg}</p>
                {lastPaymentId && (
                  <p className="text-[10px] font-mono text-red-300/70 break-all">
                    Razorpay ref: {lastPaymentId}
                  </p>
                )}
                <p className="text-[10px] text-zinc-500">
                  Attempt #{attempts}. Your card is only debited once verification succeeds.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={activate}
          disabled={busy}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black py-4 rounded-xl font-black text-sm tracking-wide shadow-lg shadow-amber-950/20 transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {phaseLabel[phase]}
          {!busy && phase !== "error" && <ArrowRight className="w-4 h-4" />}
          {!busy && phase === "error" && <RefreshCw className="w-4 h-4" />}
        </button>

        {phase === "error" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={requestFreshVerification}
              disabled={busy}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Request Fresh Verification
            </button>
            <button
              onClick={mailtoSupport}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all inline-flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" /> Contact Support
            </button>
          </div>
        )}

        <button
          onClick={finish}
          disabled={busy}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <SkipForward className="w-3 h-3" /> Skip — I'll wait for the studio link
        </button>
      </div>
    </main>
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
