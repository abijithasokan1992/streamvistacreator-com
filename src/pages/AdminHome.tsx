import { Link } from "react-router-dom";
import { ShieldQuestion, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Safe fallback landing for authenticated users whose role does not map to a
 * known dashboard. Registered under /admin/home on every host so we never
 * bounce users into a non-existent URL.
 */
export default function AdminHome() {
  const { role, signOut } = useAuth();
  return (
    <main className="relative min-h-dvh grid place-items-center bg-background text-foreground px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-accent/10 blur-[140px]" />
      </div>

      <div className="relative max-w-md w-full glass-strong rounded-3xl p-10 border border-white/5 text-center animate-fade-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 grid place-items-center mb-5">
          <ShieldQuestion className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">
          Welcome to StreamVista
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Your account {role ? <>is assigned the role <span className="font-mono text-foreground">{role}</span>, which</> : null} doesn't have a dedicated workspace yet.
          Our team will finish setting up your access shortly. If you believe this
          is a mistake, please contact support.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary"
          >
            Contact support <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
