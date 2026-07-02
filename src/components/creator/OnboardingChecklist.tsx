import { useEffect, useState } from "react";
import { Check, Circle, ArrowRight, X, Sparkles } from "lucide-react";
import type { SectionId } from "@/components/creator/CreatorSidebar";

/**
 * One-time onboarding checklist on the Creator Home.
 * - Step 1 auto-checks once the user has at least one title.
 * - Step 2 (access authorization) is marked when the user opens Billing
 *   (the agreement gate lives there) — also markable manually.
 * - Step 3 auto-checks once the user opens the Vault tab.
 * Persisted in localStorage. Dismissible.
 */

const KEY = "sv_creator_onboarding_v1";
const DISMISSED_KEY = "sv_creator_onboarding_dismissed_v1";

type State = {
  titleCreated: boolean;
  accessAuthorized: boolean;
  vaultOpened: boolean;
};

const DEFAULT_STATE: State = {
  titleCreated: false,
  accessAuthorized: false,
  vaultOpened: false,
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch { return DEFAULT_STATE; }
}
function save(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}
export function markOnboardingStep(step: keyof State) {
  const s = load();
  if (s[step]) return;
  save({ ...s, [step]: true });
}
function isDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return true; }
}
function dismiss() {
  try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* noop */ }
}

export default function OnboardingChecklist({
  hasTitles,
  onNavigate,
}: {
  hasTitles: boolean;
  onNavigate: (s: SectionId) => void;
}) {
  const [state, setState] = useState<State>(load);
  const [hidden, setHidden] = useState(isDismissed());

  // Auto-check Step 1 once a title exists.
  useEffect(() => {
    if (hasTitles && !state.titleCreated) {
      const next = { ...state, titleCreated: true };
      setState(next); save(next);
    }
  }, [hasTitles, state]);

  if (hidden) return null;
  const allDone = state.titleCreated && state.accessAuthorized && state.vaultOpened;
  if (allDone) return null;

  const completed = [state.titleCreated, state.accessAuthorized, state.vaultOpened].filter(Boolean).length;

  const go = (section: SectionId, step: keyof State) => {
    const next = { ...state, [step]: true };
    setState(next); save(next);
    onNavigate(section);
  };

  const handleDismiss = () => { dismiss(); setHidden(true); };

  return (
    <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <div>
            <p className="font-semibold">Get started</p>
            <p className="text-[11px] text-muted-foreground">{completed}/3 done · finish in 2 minutes</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss checklist"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        <Step
          done={state.titleCreated}
          label="Create your first Title"
          hint="Add a name. Files can come later."
          cta="Open Titles"
          onClick={() => go("titles", "titleCreated")}
        />
        <Step
          done={state.accessAuthorized}
          label="Complete access authorization"
          hint="Accept the creator agreement in Billing."
          cta="Open Billing"
          onClick={() => go("billing", "accessAuthorized")}
        />
        <Step
          done={state.vaultOpened}
          label="Open your Vault"
          hint="See where your master files live."
          cta="Open Vault"
          onClick={() => go("delivery_vault", "vaultOpened")}
        />
      </ul>
    </div>
  );
}

function Step({
  done, label, hint, cta, onClick,
}: {
  done: boolean; label: string; hint: string; cta: string; onClick: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
      {done ? (
        <span className="grid place-items-center w-5 h-5 rounded-full bg-accent/20">
          <Check className="w-3 h-3 text-accent" />
        </span>
      ) : (
        <Circle className="w-5 h-5 text-muted-foreground/40" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? "text-muted-foreground line-through" : "font-medium"}`}>{label}</p>
        {!done && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {!done && (
        <button
          onClick={onClick}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline shrink-0"
        >
          {cta} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </li>
  );
}
