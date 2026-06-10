import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle, ShieldCheck, Activity } from "lucide-react";

type StatusResp = {
  status?: "connected" | "disconnected";
  mode?: "live" | "test";
  title?: string;
  reason?: string;
  error_code?: string;
  error_description?: string;
  http_status?: number;
  key_id_masked?: string;
  webhook_configured?: boolean;
  latency_ms?: number;
  warnings?: string[];
  actions?: string[];
  message?: string;
  error?: string;
};

export default function RazorpayConnectivityStatus() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatusResp | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("check-razorpay-status", { body: {} });
      if (error) {
        setData({ status: "disconnected", title: "Disconnected / Fix Credentials", reason: "invoke_error", message: error.message, actions: ["Edge function unreachable.", "Check function logs."] });
      } else {
        setData(resp as StatusResp);
      }
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) return null;

  const connected = data?.status === "connected";
  const mode = data?.mode;

  return (
    <Card className="glass border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Credential Connectivity Status</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            connected ? (
              <Badge className={mode === "live" ? "bg-emerald-600 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-500"}>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {mode === "live" ? "Connected (Live)" : "Connected (Test)"}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" />
                Disconnected / Fix Credentials
              </Badge>
            )
          )}
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="ml-1.5">Re-check</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!data && !loading && <p className="text-muted-foreground">Run a check to verify Razorpay credentials.</p>}
        {loading && !data && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Contacting Razorpay…
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Key ID:</span> {data.key_id_masked ?? "—"}</div>
              <div>
                <span className="font-medium text-foreground">Webhook:</span>{" "}
                {data.webhook_configured ? (
                  <span className="text-emerald-500 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" />configured</span>
                ) : (
                  <span className="text-amber-500 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />missing</span>
                )}
              </div>
              {typeof data.latency_ms === "number" && (
                <div><span className="font-medium text-foreground">Latency:</span> {data.latency_ms} ms</div>
              )}
              {data.http_status && (
                <div><span className="font-medium text-foreground">HTTP:</span> {data.http_status}</div>
              )}
            </div>

            {!connected && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">
                      {data.error_code ? `${data.error_code}` : "Connectivity failed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.error_description || data.message || "Razorpay rejected the credentials."}
                    </p>
                  </div>
                </div>
                {!!data.actions?.length && (
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    {data.actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
              </div>
            )}

            {connected && !!data.warnings?.length && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-amber-600 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Warnings
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {lastChecked && (
              <p className="text-[11px] text-muted-foreground">Last checked: {lastChecked.toLocaleTimeString()}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
