import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, WifiOff, Lock, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode }
interface State { error: Error | null; info: string | null }

/**
 * Admin-only error boundary. Where the global <ErrorBoundary> shows a generic
 * "something interrupted" screen, this one is deliberately diagnostic: it
 * classifies the failure (network, RLS, auth, unknown) and shows the admin
 * exactly what to check next so empty admin tables are never a silent failure.
 *
 * This boundary ONLY wraps the admin console — it does not touch the Oracle
 * OCI monitor or any other working subsystem.
 */
export default class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AdminErrorBoundary]", error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }
  reset = () => this.setState({ error: null, info: null });

  classify(msg: string): { kind: "network" | "rls" | "auth" | "unknown"; title: string; hint: string; Icon: any } {
    const m = msg.toLowerCase();
    if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("cors")) {
      return {
        kind: "network",
        title: "Network / CORS blocked",
        hint: "The browser could not reach the backend. Confirm app.crayonspictures.com is whitelisted in site_config and that you're online.",
        Icon: WifiOff,
      };
    }
    if (m.includes("permission denied") || m.includes("rls") || m.includes("row-level") || m.includes("policy")) {
      return {
        kind: "rls",
        title: "RLS blocked the query",
        hint: "Your admin role is missing a SELECT policy on this table. Re-run the admin-bypass migration or check public.has_role(auth.uid(),'admin').",
        Icon: Lock,
      };
    }
    if (m.includes("jwt") || m.includes("unauthorized") || m.includes("401")) {
      return {
        kind: "auth",
        title: "Session expired",
        hint: "Sign out and back in to refresh your admin session.",
        Icon: ShieldAlert,
      };
    }
    return {
      kind: "unknown",
      title: "Unexpected error",
      hint: "Check the browser console for the full stack. Most admin queries should bypass RLS via the has_role() helper.",
      Icon: Database,
    };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const dx = this.classify(this.state.error.message || "");
    const Icon = dx.Icon;

    return (
      <div className="min-h-dvh bg-background text-foreground p-6 flex items-center justify-center">
        <div className="max-w-xl w-full space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 ring-1 ring-destructive/30 grid place-items-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Admin Console</p>
              <h1 className="text-xl font-semibold">Data failed to load</h1>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="h-4 w-4 text-destructive" />
              {dx.title}
            </div>
            <p className="text-sm text-muted-foreground">{dx.hint}</p>
            <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {this.state.error.message || "No error message"}
            </pre>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={this.reset}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Hard reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
