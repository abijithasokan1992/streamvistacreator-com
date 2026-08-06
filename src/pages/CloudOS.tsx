import { ArrowLeft, ArrowRight, Boxes, Bot, CheckCircle2, Search, Sparkles } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { cloudOsAppUrl, STREAMVISTA_APPS, STREAMVISTA_SUITES } from "@/platform/appRegistry";

const statusLabel = {
  live: "Live",
  beta: "Beta",
  planned: "Planned",
} as const;

export default function CloudOS() {
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get("app");
  const selectedApp = STREAMVISTA_APPS.find((app) => app.id === selectedId);
  const liveCount = STREAMVISTA_APPS.filter((app) => app.status === "live").length;
  const commercialCount = STREAMVISTA_APPS.filter((app) => app.commercial).length;

  if (selectedApp) {
    const suite = STREAMVISTA_SUITES.find((item) => item.id === selectedApp.suite);
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b border-border/70 bg-gradient-to-b from-primary/10 via-background to-background">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <Link to="/settings/integrations/ai-assistants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to App Store
            </Link>
            <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
                  <Sparkles className="h-4 w-4" /> {suite?.name ?? "StreamVista Cloud OS"}
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">{selectedApp.name}</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{selectedApp.description}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="mt-1 text-lg font-semibold">{statusLabel[selectedApp.status]}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            {selectedApp.capabilities.map((capability) => (
              <article key={capability} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
                  <div>
                    <p className="font-medium">{capability}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Connected module workspace in StreamVista Cloud OS.</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Module workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This public preview keeps navigation open without login. Production actions such as save, publish, payment, deletion and customer data access remain disabled until the module is connected to its governed backend.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Open demo workspace</button>
              <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">View workflow</button>
              <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">Commercial setup</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/70 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
                <Sparkles className="h-4 w-4" /> StreamVista Cloud OS
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">One operating system. Every business app.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Activate media, business, automotive, commerce, finance, legal, cloud and AI products from one governed platform.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric value={String(STREAMVISTA_SUITES.length)} label="Suites" />
              <Metric value={String(commercialCount)} label="Apps" />
              <Metric value={String(liveCount)} label="Live" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><Bot className="h-5 w-5" /></div>
            <div>
              <p className="font-medium">StreamVista AI Designer</p>
              <p className="text-sm text-muted-foreground">Own UI generation, component systems and deployment workflows.</p>
            </div>
          </div>
          <Link to={cloudOsAppUrl("ai-designer")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
            Open Designer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Search apps, agents, workflows and suites" />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {STREAMVISTA_SUITES.map((suite) => {
            const apps = STREAMVISTA_APPS.filter((app) => app.suite === suite.id);
            return (
              <article key={suite.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-xl bg-muted p-3"><Boxes className="h-5 w-5" /></div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{apps.length} apps</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold">{suite.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{suite.description}</p>
                <div className="mt-5 space-y-3">
                  {apps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{app.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{statusLabel[app.status]}</p>
                      </div>
                      <Link to={cloudOsAppUrl(app.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Open</Link>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-20 rounded-2xl border border-border bg-card p-4 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
