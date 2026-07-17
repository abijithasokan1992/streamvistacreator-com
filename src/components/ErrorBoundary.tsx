import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props { children: ReactNode }
interface State {
  error: Error | null;
  componentStack: string | null;
  reporting: boolean;
  reported: boolean;
}

/**
 * App-wide safety net. Any uncaught render error inside <ErrorBoundary> is
 * caught here so the user sees a recoverable screen instead of a white page.
 *
 * The fallback UI also includes a "Report to admin" button that posts the
 * crash to the `system-report` edge function (creating a support ticket and
 * emailing every admin) — this complements <SystemMessageBox> for async errors.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, reporting: false, reported: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, reported: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  reset = () => {
    this.setState({ error: null, componentStack: null, reported: false });
  };

  goHome = () => {
    this.setState({ error: null, componentStack: null, reported: false });
    if (typeof window !== "undefined") window.location.href = "/";
  };

  reportToAdmin = async () => {
    if (this.state.reporting || this.state.reported) return;
    this.setState({ reporting: true });
    try {
      const stackHead = (this.state.error?.stack || "").split("\n").slice(0, 6).join("\n");
      const compHead = (this.state.componentStack || "").split("\n").slice(0, 6).join("\n");
      const { data, error } = await supabase.functions.invoke("system-report", {
        body: {
          title: `Render crash: ${this.state.error?.message?.slice(0, 120) || "Unknown error"}`,
          message: `The React tree threw while rendering.\n\n${stackHead}`,
          severity: "error",
          context: `componentStack:\n${compHead}`,
          page: typeof window !== "undefined" ? window.location.pathname : "",
        },
      });
      if (error || !data?.ok) {
        toast.error("Could not send crash report", { description: error?.message ?? data?.error });
        this.setState({ reporting: false });
        return;
      }
      toast.success("Crash report sent to admin");
      this.setState({ reporting: false, reported: true });
    } catch (e) {
      toast.error("Could not send crash report", { description: e instanceof Error ? e.message : String(e) });
      this.setState({ reporting: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { reporting, reported } = this.state;

    return (
      <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 ring-1 ring-destructive/30 grid place-items-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">StreamVista Cloud X</p>
            <h1 className="text-2xl font-semibold tracking-tight">Something interrupted the stream</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred while rendering this view. Your data is safe.
            </p>
            {this.state.error.message && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={this.reset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" /> Try again
            </Button>
            <Button onClick={this.goHome} variant="outline">
              <Home className="h-4 w-4 mr-2" /> Go home
            </Button>
            <Button
              onClick={this.reportToAdmin}
              variant="outline"
              disabled={reporting || reported}
              className="gap-2"
            >
              {reporting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ShieldAlert className="h-4 w-4" />}
              {reported ? "Reported" : "Report to admin"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
