import { Link } from "react-router-dom";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { Accessibility as A11yIcon, Keyboard, Eye, Ear, Users, Mail } from "lucide-react";

/**
 * StreamVista Accessibility Statement
 * Public commitment page — WCAG 2.2 AA target, keyboard support,
 * assistive-tech compatibility, and a contact channel for issues.
 */
export default function AccessibilityPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Seo
        title="Accessibility at StreamVista — WCAG 2.2 AA Commitment"
        description="StreamVista's accessibility statement: WCAG 2.2 AA target, full keyboard support, assistive-tech compatibility, and a contact channel for reporting barriers."
        path="/accessibility"
      />
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <Navbar />
      <main id="main-content" className="container pt-28 pb-16 max-w-3xl">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <A11yIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Accessibility</span>
          </div>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-black tracking-tight">
            Accessibility at StreamVista
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">
            One Secure Cloud for Films, Series &amp; Shows — built to be usable by
            everyone who works on them.
          </p>
        </header>

        <section aria-labelledby="commitment" className="space-y-3 mb-10">
          <h2 id="commitment" className="text-xl font-semibold">Our commitment</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            StreamVista is committed to making its platform accessible to all
            creators, studios, buyers and administrators — including people who
            rely on assistive technologies. We target conformance with the{" "}
            <strong className="text-foreground">Web Content Accessibility
            Guidelines (WCAG) 2.2, Level AA</strong>, and treat accessibility as
            an ongoing engineering discipline rather than a one-time audit.
          </p>
        </section>

        <section aria-labelledby="supported" className="space-y-4 mb-10">
          <h2 id="supported" className="text-xl font-semibold">What we support</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            <li className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Keyboard className="h-4 w-4 text-accent" aria-hidden="true" />
                Keyboard navigation
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Every workflow — uploads, reviews, checkout, admin — can be
                completed with Tab, Shift+Tab, Enter, Space, Escape and arrow keys.
              </p>
            </li>
            <li className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Eye className="h-4 w-4 text-accent" aria-hidden="true" />
                Visible focus indicators
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                A high-contrast accent focus ring appears on every interactive
                element and is preserved in both light and dark themes.
              </p>
            </li>
            <li className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Ear className="h-4 w-4 text-accent" aria-hidden="true" />
                Screen reader compatibility
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Tested with NVDA and JAWS on Windows, VoiceOver on macOS/iOS,
                and TalkBack on Android. Uploads, dialogs and toasts announce
                progress via ARIA live regions.
              </p>
            </li>
            <li className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Users className="h-4 w-4 text-accent" aria-hidden="true" />
                Reduced motion &amp; contrast
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                We respect <code>prefers-reduced-motion</code> and calibrate
                text, borders and status colors for WCAG 2.2 AA contrast.
              </p>
            </li>
          </ul>
        </section>

        <section aria-labelledby="scope" className="space-y-3 mb-10">
          <h2 id="scope" className="text-xl font-semibold">Scope</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The accessibility commitments on this page apply to the StreamVista
            web application at <code>streamvista.in</code>, including the
            Creator Hub, Studio Workspace, Buyer marketplace, checkout, and
            admin console. Third-party embeds (for example payment providers)
            follow their own accessibility policies.
          </p>
        </section>

        <section aria-labelledby="report" className="space-y-3 mb-10">
          <h2 id="report" className="text-xl font-semibold">Report an issue</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you encounter an accessibility barrier on StreamVista, we want to
            hear about it. Please include the page URL, the assistive
            technology and browser you were using, and a description of what
            happened.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground text-sm font-semibold px-4 py-2 hover:opacity-90 transition"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact StreamVista Support
            </Link>
            <a
              href="mailto:accessibility@streamvista.in"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 text-sm px-4 py-2 hover:bg-secondary/60 transition"
            >
              accessibility@streamvista.in
            </a>
          </div>
        </section>

        <section aria-labelledby="review" className="space-y-3">
          <h2 id="review" className="text-xl font-semibold">Ongoing review</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This statement is maintained by the StreamVista engineering team
            and reviewed as the platform evolves. Last updated{" "}
            {new Date().toLocaleDateString(undefined, {
              day: "2-digit", month: "long", year: "numeric",
            })}.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
