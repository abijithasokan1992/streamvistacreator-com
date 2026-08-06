import {
  Activity,
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
  const selectedApp = STREAMVISTA_APPS.find((app) => app.id === selectedId) ?? STREAMVISTA_APPS[0];
  const selectedSuite = STREAMVISTA_SUITES.find((suite) => suite.id === selectedApp.suite);
  const liveCount = STREAMVISTA_APPS.filter((app) => app.status === "live").length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[290px_1fr]">
        <aside className="border-r border-border bg-card p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <Link to="/settings/integrations/ai-assistants" className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Sparkles className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">StreamVista Cloud OS</p>
              <p className="text-xs text-muted-foreground">Unified Control Center</p>
            </div>
          </Link>

          <div className="mt-5 rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Search everything" />
            </div>
          </div>

          <nav className="mt-6 space-y-5">
            <Link
              to="/settings/integrations/ai-assistants"
              className="flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <LayoutDashboard className="h-4 w-4" /> All Apps Dashboard
            </Link>

            {STREAMVISTA_SUITES.map((suite) => {
              const apps = STREAMVISTA_APPS.filter((app) => app.suite === suite.id);
              return (
                <section key={suite.id}>
                  <div className="mb-2 flex items-center justify-between px-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{suite.name}</p>
                    <span className="text-xs text-muted-foreground">{apps.length}</span>
                  </div>
                  <div className="space-y-1">
                    {apps.map((app) => (
                      <Link
                        key={app.id}
                        to={cloudOsAppUrl(app.id)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                          app.id === selectedApp.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">{app.name}</span>
                        <span className="ml-3 text-[10px] uppercase tracking-wide">{statusLabel[app.status]}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-border bg-card px-5 py-5 md:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{selectedSuite?.name ?? "StreamVista Cloud OS"}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">{selectedApp.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{selectedApp.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  Public Preview · No Login
                </span>
                <button className="rounded-xl border border-border p-2.5"><Bell className="h-4 w-4" /></button>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> New Record
                </button>
              </div>
            </div>
          </header>

          <div className="p-5 md:p-8">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardMetric label="Total Apps" value={String(STREAMVISTA_APPS.length)} change="Organised in one place" icon={Boxes} />
              <DashboardMetric label="Live Apps" value={String(liveCount)} change="Ready modules" icon={CheckCircle2} />
              <DashboardMetric label="Pending Actions" value="7" change="Needs review" icon={Clock3} />
              <DashboardMetric label="Team Members" value="6" change="2 active now" icon={Users} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <article className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedApp.name} Dashboard</h2>
                    <p className="mt-1 text-sm text-muted-foreground">All capabilities remain inside this unified control center.</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{statusLabel[selectedApp.status]}</span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {selectedApp.capabilities.map((capability, index) => (
                    <button key={capability} className="flex items-center justify-between rounded-2xl border border-border p-4 text-left hover:bg-muted">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><CheckCircle2 className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{capability}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Workspace #{1200 + index}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </article>

              <div className="space-y-6">
                <article className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Bot className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-semibold">StreamVista AI Designer</h3>
                      <p className="text-xs text-muted-foreground">Own UI and workflow builder</p>
                    </div>
                  </div>
                  <Link to={cloudOsAppUrl("ai-designer")} className="mt-4 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
                    Open AI Designer <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>

                <article className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-semibold">Unified navigation</h3>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <NavRow icon={Activity} label="Activity" />
                    <NavRow icon={FileText} label="Records" />
                    <NavRow icon={BarChart3} label="Reports" />
                    <NavRow icon={Settings} label="Settings" />
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>
      </div>
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

function NavRow({ icon: Icon, label }: { icon: typeof Activity; label: string }) {
  return (
    <button className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted">
      <span className="flex items-center gap-3"><Icon className="h-4 w-4" /> {label}</span>
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}
