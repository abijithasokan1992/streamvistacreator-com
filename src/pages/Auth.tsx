import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, ArrowRight, CheckCircle2, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getAppOrigin } from "@/lib/site";
import { safeNextPath } from "@/lib/auth/safeNext";
import { mapAuthError } from "@/lib/auth/authErrors";
import { Seo } from "@/components/Seo";
import { CrayonsNetwork } from "@/components/streamvista/CrayonsNetwork";
import { playMailVoice, prewarmMailVoice } from "@/lib/mailVoice";

/**
 * Passwordless magic-link auth.
 *   • Create Account: Full Name + Email + Role (Creator / Studio / Buyer)
 *   • Log In: Email only
 *
 * Google OAuth is intentionally hidden until the production provider has a
 * valid Google client configuration. This prevents users being redirected to
 * a raw Supabase 400 response when the provider secret is missing.
 *
 * Public signup is available for **Creator, Studio, and Buyer** accounts only.
 * Reviewer and internal admin access (Admin, Super Admin, QC Reviewer,
 * Legal Reviewer) are invite-only and granted by an admin — those users sign
 * in with the same magic-link form.
 */

type View = "login" | "signup";

type PublicRole = "content_owner" | "studio" | "buyer";

const ROLE_OPTIONS: { value: PublicRole; label: string; hint: string }[] = [
  { value: "content_owner", label: "Creator", hint: "Filmmakers, producers, IP holders" },
  { value: "studio", label: "Studio", hint: "Production & post-production teams" },
  { value: "buyer", label: "Buyer", hint: "Acquisitions, platforms, licensing" },
];

const EmailSchema = z.string().trim().email("Enter a valid email").max(255);
const NameSchema = z.string().trim().min(1, "Enter your full name").max(120);

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  const indicators = [
    "Instagram", "FBAN", "FBAV", "LinkedInApp",
    "Twitter", "TwitterFor", "Snapchat", "Line/",
    "MicroMessenger", "TikTok", "Bytedance", "trill",
    "Messenger", "WhatsApp", "WeChat",
  ];
  return indicators.some((i) => ua.includes(i)) || /wv|WebView/i.test(ua);
}

export default function Auth() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user, role, loading } = useAuth();
  const blockedBrowser = search.get("in_app_error") === "1";
  const sessionExpired = search.get("reason") === "session_expired";

  const intentParam = search.get("intent");
  const roleParam = search.get("role");
  const initialView: View =
    search.get("mode") === "signup" || intentParam === "signup" ? "signup" : "login";
  const [view, setView] = useState<View>(initialView);

  const [email, setEmail] = useState(search.get("email") ?? "");
  const [fullName, setFullName] = useState("");
  const initialRole: PublicRole =
    roleParam === "studio" || roleParam === "buyer" || roleParam === "content_owner"
      ? (roleParam as PublicRole)
      : "content_owner";
  const [signupRole, setSignupRole] = useState<PublicRole>(initialRole);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { prewarmMailVoice(); }, []);

  useEffect(() => {
    const n = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    if (n) {
      try { sessionStorage.setItem("sv_consent_next", n); } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const urlNext = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    let stashed: string | null = null;
    try { stashed = sessionStorage.getItem("sv_consent_next"); } catch { /* noop */ }
    const next = urlNext ?? safeNextPath(stashed);
    if (next) {
      try { sessionStorage.removeItem("sv_consent_next"); } catch { /* noop */ }
      navigate(next, { replace: true });
      return;
    }
    navigate(dashboardForRole(role), { replace: true });
  }, [user, role, loading, navigate]);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailParse = EmailSchema.safeParse(email);
    if (!emailParse.success) return toast.error(emailParse.error.issues[0].message);

    if (view === "signup") {
      const nameParse = NameSchema.safeParse(fullName);
      if (!nameParse.success) return toast.error(nameParse.error.issues[0].message);
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailParse.data,
      options: {
        emailRedirectTo: `${getAppOrigin()}/auth/callback`,
        shouldCreateUser: view === "signup",
        data: view === "signup"
          ? {
              display_name: fullName.trim(),
              full_name: fullName.trim(),
              requested_role: signupRole,
            }
          : undefined,
      },
    });
    setSubmitting(false);

    if (error) {
      if (view === "login" && /user.*not.*found|signups.*disabled/i.test(error.message)) {
        toast.error("No account with that email. Create one first.");
        setView("signup");
        return;
      }
      return toast.error(mapAuthError(error).message);
    }

    if (view === "signup") {
      try {
        sessionStorage.setItem("sv_pending_role", signupRole);
        sessionStorage.setItem("sv_pending_name", fullName.trim());
      } catch { /* noop */ }
    }
    setSent(true);
    void playMailVoice();
  };

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-background text-foreground grid place-items-center px-4 py-12">
      <Seo
        title="Sign in to StreamVista Cloud X — Creator Studio"
        description="Sign in or create your StreamVista Cloud X account to upload, review and deliver film projects from set to screen."
        path="/auth"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 w-[480px] h-[480px] rounded-full bg-accent/15 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="block text-center mb-8 text-sm uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </Link>

        <div className="glass-strong rounded-3xl p-8 md:p-10 border border-white/5">
          {blockedBrowser ? (
            <OpenInBrowserNotice prominent />
          ) : sent ? (
            <SentState email={email} onAnother={() => setSent(false)} />
          ) : (
            <>
              <header className="text-center mb-7">
                <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                  {view === "signup" ? "Create your account" : "Log in"}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  {view === "signup"
                    ? "We'll send a one-tap magic link to your inbox — no password to remember."
                    : "Enter your email and we'll send a magic link."}
                </p>
              </header>

              {sessionExpired && (
                <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  Your session expired. Sign in again to pick up where you left off — we've saved your destination.
                </div>
              )}

              <div className="mb-6 grid grid-cols-2 gap-1 p-1 rounded-xl bg-input/30 border border-border/50">
                <TabButton active={view === "login"} onClick={() => setView("login")}>Log in</TabButton>
                <TabButton active={view === "signup"} onClick={() => setView("signup")}>Create account</TabButton>
              </div>

              <form onSubmit={sendMagicLink} className="space-y-4">
                {view === "signup" && (
                  <Input
                    label="Full name"
                    value={fullName}
                    onChange={setFullName}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                )}
                <Input
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />

                {view === "signup" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground/90 uppercase tracking-wider">
                      I am a…
                    </label>
                    <div className="mt-2 grid gap-2">
                      {ROLE_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setSignupRole(o.value)}
                          className={cn(
                            "w-full text-left rounded-xl border p-3 transition-all",
                            signupRole === o.value
                              ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                              : "border-border/60 hover:border-border bg-input/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{o.label}</span>
                            {signupRole === o.value && <CheckCircle2 className="w-4 h-4 text-accent" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{o.hint}</div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground/70">
                      Public sign-up is available for Creator, Studio, and Buyer accounts only. Reviewer and internal admin access are invite-only.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 glow-primary"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      {view === "signup" ? "Send magic link" : "Email me a magic link"}
                    </>
                  )}
                </button>
              </form>

              {isInAppBrowser() && (
                <div className="mt-5">
                  <OpenInBrowserNotice />
                </div>
              )}

              <p className="mt-6 text-[11px] text-muted-foreground/70 text-center">
                By continuing you agree to our{" "}
                <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>

        <div className="mt-8">
          <CrayonsNetwork />
        </div>
      </div>
    </main>
  );
}

function SentState({ email, onAnother }: { email: string; onAnother: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-accent/10 grid place-items-center">
        <Mail className="w-6 h-6 text-accent" />
      </div>
      <h2 className="font-display text-xl font-semibold">Check your inbox</h2>
      <p className="text-sm text-muted-foreground mt-2">
        We sent a magic link to <span className="text-foreground font-medium">{email}</span>.
        Open it on this device to sign in.
      </p>
      <p className="text-[11px] text-muted-foreground/70 mt-4">
        The link expires in 1 hour. You can close this tab — the link will bring you back.
      </p>
      <button
        onClick={onAnother}
        className="mt-6 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        Use a different email <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg text-xs font-semibold uppercase tracking-[0.15em] transition-all",
        active ? "bg-gradient-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Input({
  label, value, onChange, placeholder, type = "text", autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground/90 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1.5 w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm placeholder:text-muted-foreground outline-none focus:border-accent/70 focus:bg-input/70"
      />
    </label>
  );
}

function OpenInBrowserNotice({ prominent = false }: { prominent?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = (() => {
    if (typeof window === "undefined") return "";
    try {
      const stashed = sessionStorage.getItem("sv_pending_auth_url");
      if (stashed) return stashed;
    } catch { /* noop */ }
    return window.location.href;
  })();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied. Open it in Safari or Chrome to continue.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link. Please copy the address bar manually.");
    }
  };

  if (prominent) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-5 mb-6">
        <h3 className="text-base font-semibold text-foreground">
          Open StreamVista in your browser to continue
        </h3>
        <p className="text-sm text-muted-foreground mt-1.5">
          Secure sign-in is blocked inside this app browser.
          Open this page in Safari on iPhone or Chrome on Android, then continue sign-in there.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 glow-primary"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Browser
          </a>

          <button
            onClick={handleCopy}
            className="w-full h-10 rounded-xl border border-border/60 bg-input/20 hover:bg-input/40 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            {copied ? "Link copied!" : "Copy link"}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
          If you opened this from WhatsApp, Gmail, Instagram, or another app, use that app's browser menu and choose Open in Browser.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-input/20 p-4 mb-6">
      <div className="flex items-start gap-3">
        <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">In-app browser detected.</p>
          <p className="text-xs text-muted-foreground mt-1">
            For the best sign-in experience, open this page in your device's default browser.
          </p>
          <button
            onClick={handleCopy}
            className="mt-2 text-xs inline-flex items-center gap-1 text-accent hover:underline"
          >
            {copied ? "Link copied!" : "Copy link to open in browser"}
          </button>
        </div>
      </div>
    </div>
  );
}
