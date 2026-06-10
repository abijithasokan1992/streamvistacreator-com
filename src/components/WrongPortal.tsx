import { Link } from "react-router-dom";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { urlForHost, type HostMode } from "@/hooks/useHostMode";

/**
 * Shown when a route is accessed on the wrong host
 * (e.g. /admin on the public domain, or /vault on the admin subdomain).
 */
export default function WrongPortal({
  expected,
  message,
}: {
  expected: HostMode;
  message?: string;
}) {
  const target = urlForHost(expected, expected === "admin" ? "/auth" : "/");
  const label =
    expected === "admin"
      ? "Go to admin.streamvistacreator.com"
      : "Go to streamvistacreator.com";

  return (
    <main className="relative min-h-dvh grid place-items-center bg-background text-foreground px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-destructive/10 blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="relative max-w-md w-full glass-strong rounded-3xl p-10 border border-white/5 text-center animate-fade-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/30 grid place-items-center mb-5">
          <ShieldAlert className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">
          {expected === "admin" ? "Wrong Portal" : "Not Available Here"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-7">
          {message ??
            (expected === "admin"
              ? "The admin console lives on a separate, secured subdomain. You're currently on the public site."
              : "This area is only available on the public site, not the admin portal.")}
        </p>

        {target.startsWith("http") ? (
          <a
            href={target}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary"
          >
            {label} <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <Link
            to={target}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary"
          >
            {label} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </main>
  );
}
