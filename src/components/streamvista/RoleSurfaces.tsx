import { Film, Layers, Briefcase, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import type { AppRole } from "@/hooks/useAuth";

/**
 * Multi-tier routing block — Creator / Studio / Licensing (+ Admin for staff).
 * Smart CTAs: signed-in users with the matching role land directly on that
 * tier's dashboard; everyone else falls back to the role-scoped signup.
 */

type Surface = {
  key: "creator" | "studio" | "buyer" | "admin";
  role: AppRole;
  title: string;
  icon: typeof Film;
  pitch: string;
  chips: string[];
  signedOutTo: string;
  labelSignedOut: string;
  labelSignedIn: string;
  adminOnly?: boolean;
};

const SURFACES: Surface[] = [
  {
    key: "creator",
    role: "content_owner",
    title: "Creator",
    icon: Film,
    pitch: "Submit titles. Hold rights. Stay protected.",
    chips: ["Secure Intake", "Master Vault", "Rights Control"],
    signedOutTo: "/auth?intent=signup&role=content_owner",
    labelSignedOut: "Enter Creator",
    labelSignedIn: "Open Creator Dashboard",
  },
  {
    key: "studio",
    role: "studio",
    title: "Studio",
    icon: Layers,
    pitch: "Run post, QC and delivery from one vault.",
    chips: ["Ingest & Mastering", "QC & Delivery", "Role-Based Access"],
    signedOutTo: "/auth?intent=signup&role=studio",
    labelSignedOut: "Enter Studio",
    labelSignedIn: "Open Studio Dashboard",
  },
  {
    key: "buyer",
    role: "buyer",
    title: "Licensing",
    icon: Briefcase,
    pitch: "Request screeners. Close deals under NDA.",
    chips: ["NDA Gate", "Screeners", "Deal Room"],
    signedOutTo: "/auth?intent=signup&role=buyer",
    labelSignedOut: "Enter Licensing",
    labelSignedIn: "Open Buyer Dashboard",
  },
  {
    key: "admin",
    role: "admin",
    title: "Admin",
    icon: ShieldCheck,
    pitch: "Oversee ops, moderation, and platform health.",
    chips: ["Ops Console", "Moderation", "Finance"],
    signedOutTo: "/auth",
    labelSignedOut: "Staff Sign-In",
    labelSignedIn: "Open Admin Console",
    adminOnly: true,
  },
];

export const RoleSurfaces = () => {
  const { signedIn, isAdmin, routeFor } = useUserRoles();
  const surfaces = SURFACES.filter((s) => !s.adminOnly || isAdmin);
  const gridCols = surfaces.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <section id="for" className="py-24 border-b border-border/40 relative">
      <div className="container">
        <div className="mb-14 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px" style={{ background: "var(--gradient-primary)" }} />
            <span className="eyebrow">
              {surfaces.length} surfaces · One platform
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
            Choose your <span className="gradient-text">door</span>
          </h2>
        </div>

        <div className={`grid ${gridCols} gap-px bg-border/60 border border-border-strong/60 rounded-2xl overflow-hidden`}>
          {surfaces.map(({ key, role, title, icon: Icon, pitch, chips, signedOutTo, labelSignedOut, labelSignedIn }) => {
            const to = signedIn ? routeFor(role, signedOutTo) : signedOutTo;
            const label = signedIn ? labelSignedIn : labelSignedOut;
            return (
              <article key={key} className="group relative bg-card p-7 md:p-9 flex flex-col transition-colors hover:bg-card/60">
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight">{title}</h3>
                  <div
                    className="w-11 h-11 rounded-xl grid place-items-center text-primary-foreground border border-primary/30"
                    style={{
                      backgroundImage: "var(--gradient-primary)",
                      boxShadow: "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 8px 22px -10px hsl(var(--primary) / 0.6)",
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-[15px] text-text-secondary leading-relaxed mb-6 font-medium">{pitch}</p>

                <div className="flex flex-wrap gap-2 mb-8">
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="px-2.5 py-1 rounded-md border border-border-strong/60 bg-background/40 text-[11px] font-mono-tech uppercase tracking-[0.14em] text-text-secondary"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <Link
                  to={to}
                  className="btn-emboss group/btn mt-auto h-11 w-full inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.18em] text-[11px] rounded-md"
                  aria-label={label}
                >
                  <span>{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
