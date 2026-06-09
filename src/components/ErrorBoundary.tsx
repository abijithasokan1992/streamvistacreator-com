import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * App-wide safety net. Any uncaught render error inside <ErrorBoundary> is
 * caught here so the user sees a recoverable screen instead of a white page.
 * Async errors (fetch, promise rejections) bubble through window listeners.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console — Lovable Cloud captures these.
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  goHome = () => {
    this.setState({ error: null });
    if (typeof window !== "undefined") window.location.href = "/";
  };

  render() {
    if (!this.state.error) return this.props.children;

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
          <div className="flex items-center justify-center gap-3">
            <Button onClick={this.reset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" /> Try again
            </Button>
            <Button onClick={this.goHome} variant="outline">
              <Home className="h-4 w-4 mr-2" /> Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
