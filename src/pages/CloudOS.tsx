import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
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
        <div className="grid min-h-screen lg:grid-cols-[250px_1fr]">
          <aside className="border-r border-border bg-card p-5">
            <Link
              to="/settings/integrations/ai-assistants"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> App Store
            </Link>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{suite?.name}</p>
              <h1 className="mt-2 text-xl font-semibold">{selectedApp.name}</h1>
              <span className="mt-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                {statusLabel[selectedApp.status]}
              </span>
            </div>

            <nav className="mt-8 space-y-2">
              {[
                [LayoutDashboard, "Dashboard"],
                [Activity, "Activity"],
                [Users, "Users"],
                [FileText, "Records"],
                [BarChart3, "Reports"],
                [Settings, "Settings"],
              ].map(([Icon, label], index) => {
                const NavIcon = Icon as typeof LayoutDashboard;
                return (
                  <button
                    key={label as string}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                      index === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <NavIcon className="h-4 w-4" /> {label as string}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            <header className="flex flex-col gap-4 border-b border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
              <div>
                <p className="text-sm text-muted-foreground">StreamVista Cloud OS</p>
                <h2 className="text-2xl font-semibold">{selectedApp.name} Dashboard</h2>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-xl border border-border p-2.5"><Bell className="h-4 w-4" /></button>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> New Record
                </button>
              </div>
            </header>

            <div className="p-5 md:p-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DashboardMetric label="Active Records" value="128" change="+12 this week" icon={Boxes} />
                <DashboardMetric label="Pending Actions" value="7" change="Needs review" icon={Clock3} />
                <DashboardMetric label="Completed" value="94" change="73% completion" icon={CheckCircle2} />
                <DashboardMetric label="Team Members" value="6" change="2 active now" icon={Users} />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <article className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">Operations overview</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Live module activity and workflow status.</p>
                    </div>
                    <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium">View all</button>
                  </div>

                  <div className="mt-6 space-y-4">
                    {selectedApp.capabilities.slice(0, 5).map((capability, index) => (
                      <div key={capability} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><CheckCircle2 className="h-4 w-4" /></div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{capability}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Workflow #{1200 + index}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {index % 2 === 0 ? "Active" : "Review"}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="space-y-6">
                  <article className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-lg font-semibold">Quick actions</h3>
                    <div className="mt-4 grid gap-3">
                      {selectedApp.capabilities.slice(0, 4).map((capability) => (
                        <button key={capability} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted">
                          <span>{capability}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-lg font-semibold">Recent activity</h3>
                    <div className="mt-4 space-y-4 text-sm">
                      <ActivityRow title="New record created" time="5 min ago" />
                      <ActivityRow title="Workflow moved to review" time="32 min ago" />
                      <ActivityRow title="Report generated" time="2 hours ago" />
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </div>
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

function DashboardMetric({ label, value, change, icon: Icon }: { label: string; value: string; change: string; icon: typeof Boxes }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
        <span className="text-xs text-muted-foreground">Live</span>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{change}</p>
    </article>
  );
}

function ActivityRow({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
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
