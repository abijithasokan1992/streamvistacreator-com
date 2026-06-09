import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Link2, Inbox, ShieldCheck } from "lucide-react";
import OnboardingCompleteBanner from "@/components/OnboardingCompleteBanner";

/**
 * Client dashboard — view-only.
 * Clients access content via signed share links (/s/:token), not their own vault.
 * This page is a landing hub; no privileged data is fetched here (RLS would block it anyway).
 */
export default function Client() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">Client Workspace</div>
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

      <main className="container py-10 max-w-3xl">
        <OnboardingCompleteBanner />
        <h1 className="font-display text-2xl font-bold mb-2">Welcome</h1>
        <p className="text-muted-foreground mb-6">
          Your account is set up as a <span className="text-accent">Client</span>. Open any share
          link sent by your studio to review and download files.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="glass-strong rounded-2xl p-5 border border-border/40">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Link2 className="w-3.5 h-3.5" /> Open a share link
            </div>
            <p className="mt-2 text-sm">Paste the link from your studio email into the address bar — e.g. <code className="text-accent">/s/abc123…</code></p>
          </div>
          <div className="glass-strong rounded-2xl p-5 border border-border/40">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Inbox className="w-3.5 h-3.5" /> Need creator access?
            </div>
            <p className="mt-2 text-sm">Ask your studio admin to upgrade your account so you can upload your own assets.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
