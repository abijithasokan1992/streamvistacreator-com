import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Orbit, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PublicFrontTemplate = "stories_sphere" | "business_avatar";

type StoredValue =
  | PublicFrontTemplate
  | { template?: PublicFrontTemplate }
  | null;

const SETTING_KEY = "public_front_template";
const DEFAULT_TEMPLATE: PublicFrontTemplate = "stories_sphere";
const CURRENT_TEMPLATE_URL =
  "https://fix-public-front-gate-domain-separation-long-paper-9da0.abijithasokan1992.workers.dev/";

function parseTemplate(value: StoredValue | unknown): PublicFrontTemplate {
  if (value === "stories_sphere" || value === "business_avatar") return value;
  if (value && typeof value === "object" && "template" in value) {
    const template = (value as { template?: unknown }).template;
    if (template === "stories_sphere" || template === "business_avatar") return template;
  }
  return DEFAULT_TEMPLATE;
}

const TEMPLATES: Array<{
  id: PublicFrontTemplate;
  title: string;
  subtitle: string;
  badge: string;
}> = [
  {
    id: "stories_sphere",
    title: "Stories Sphere",
    subtitle: "Preserved current public front · cinematic story-first entry",
    badge: "Current / Preserved",
  },
  {
    id: "business_avatar",
    title: "StreamVista Avatar",
    subtitle: "Living business interface · Creator → Rights → Licensing → Distribution → Revenue",
    badge: "Business AI",
  },
];

export function PublicFrontTemplateControl() {
  const [active, setActive] = useState<PublicFrontTemplate>(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PublicFrontTemplate | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    setLoading(false);

    if (error) {
      toast.error(`Could not load public-front template: ${error.message}`);
      return;
    }
    setActive(parseTemplate(data?.value));
  };

  useEffect(() => {
    void load();
  }, []);

  const choose = async (next: PublicFrontTemplate) => {
    if (saving || next === active) return;
    setSaving(next);

    const { data: auth } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: SETTING_KEY,
        category: "public_front",
        description:
          "Canonical StreamVista public-front template read by the Cloudflare Worker. Allowed: stories_sphere | business_avatar.",
        value: { template: next },
        updated_at: now,
        updated_by: auth.user?.id ?? null,
      },
      { onConflict: "key" },
    );

    if (error) {
      setSaving(null);
      toast.error(`Template switch failed: ${error.message}`);
      return;
    }

    // Read back before showing success so the UI never reports a fake switch.
    const { data: verified, error: verifyError } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    const verifiedTemplate = parseTemplate(verified?.value);
    setSaving(null);

    if (verifyError || verifiedTemplate !== next) {
      toast.error(
        verifyError
          ? `Template saved but verification failed: ${verifyError.message}`
          : "Template verification failed. Public front was not marked active.",
      );
      return;
    }

    setActive(next);
    toast.success(
      next === "business_avatar"
        ? "StreamVista Avatar selected"
        : "Stories Sphere restored",
    );
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-background/35 p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Orbit className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Public Front Template</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-3xl">
            One click changes the public-facing experience only. Auth, projects, rights, CRM, buyer workflows and backend data stay on the same StreamVista system.
          </p>
        </div>
        <a
          href={CURRENT_TEMPLATE_URL}
          target="_blank"
          rel="noreferrer"
          className="h-8 px-3 rounded-md border border-border text-[11px] inline-flex items-center gap-1.5 hover:bg-secondary"
        >
          Current Worker <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {loading ? (
        <div className="h-40 grid place-items-center">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {TEMPLATES.map((template) => {
            const isActive = active === template.id;
            const isSaving = saving === template.id;
            return (
              <button
                type="button"
                key={template.id}
                onClick={() => void choose(template.id)}
                disabled={saving !== null}
                className={`text-left rounded-xl border p-4 transition-all disabled:cursor-wait ${
                  isActive
                    ? "border-emerald-500/60 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                    : "border-border/60 bg-secondary/10 hover:bg-secondary/25 hover:border-accent/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {template.badge}
                    </div>
                    <div className="mt-1 font-semibold flex items-center gap-2">
                      {template.title}
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {template.subtitle}
                    </p>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>

                <div className="mt-4 h-28 overflow-hidden rounded-lg border border-border/50 bg-black/70 relative">
                  {template.id === "stories_sphere" ? (
                    <StoriesSpherePreview />
                  ) : (
                    <BusinessAvatarPreview />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Contract: <code>platform_settings.public_front_template</code> → <code>stories_sphere</code> or <code>business_avatar</code>. The canonical Cloudflare Worker reads this setting and safely falls back to Stories Sphere.
      </p>
    </section>
  );
}

function StoriesSpherePreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.12),transparent_55%)]" />
      <div className="relative w-16 h-16 rounded-full border border-accent/50 shadow-[0_0_42px_hsl(var(--accent)/0.18)]">
        <div className="absolute inset-2 rounded-full border border-white/15" />
        <div className="absolute inset-[18px] rounded-full bg-white/80" />
      </div>
      <span className="absolute bottom-3 text-[9px] uppercase tracking-[0.24em] text-white/45">Stories move here</span>
    </div>
  );
}

function BusinessAvatarPreview() {
  const stages = ["Creator", "Rights", "Licensing", "Distribution", "Revenue"];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.16),transparent_58%)]" />
      <div className="relative w-16 h-16 rounded-full border border-accent/60 shadow-[0_0_45px_hsl(var(--accent)/0.2)] grid place-items-center">
        <div className="absolute -inset-3 rounded-full border border-white/10" />
        <div className="absolute -inset-7 rounded-full border border-white/[0.06]" />
        <Sparkles className="w-5 h-5 text-white/85" />
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-1">
        {stages.map((stage) => (
          <span key={stage} className="text-[7px] uppercase tracking-wide text-white/40 truncate">
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}
