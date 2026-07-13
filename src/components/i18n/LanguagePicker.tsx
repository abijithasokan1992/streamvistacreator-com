import { useLocale } from "@/hooks/useLocale";
import { Globe } from "lucide-react";

/**
 * LanguagePicker — one-time first-visit modal that asks the user to choose
 * their interface language. Never dismissible without a selection so we can
 * persist the choice to both localStorage and `user_profiles.locale`.
 */
export default function LanguagePicker() {
  const { setLocale } = useLocale();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-picker-title"
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur grid place-items-center px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/70 p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/15 grid place-items-center">
            <Globe className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 id="lang-picker-title" className="font-display text-lg leading-tight">
              Choose your interface language
            </h2>
            <p
              className="text-lg leading-tight mt-1"
              style={{ fontFamily: "'Noto Sans Malayalam', system-ui, sans-serif" }}
              lang="ml"
            >
              ഇന്റർഫേസ് ഭാഷ തിരഞ്ഞെടുക്കുക
            </p>
          </div>
        </div>

        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => setLocale("ml")}
            className="w-full rounded-xl border border-border/60 bg-secondary/10 hover:bg-secondary/20 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <p
              className="text-base font-semibold"
              style={{ fontFamily: "'Noto Sans Malayalam', system-ui, sans-serif" }}
              lang="ml"
            >
              മലയാളം
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Malayalam</p>
          </button>

          <button
            type="button"
            onClick={() => setLocale("en")}
            className="w-full rounded-xl border border-border/60 bg-secondary/10 hover:bg-secondary/20 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <p className="text-base font-semibold">English</p>
            <p className="text-xs text-muted-foreground mt-0.5">English</p>
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          You can change this anytime from the dashboard header.
        </p>
      </div>
    </div>
  );
}
