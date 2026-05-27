import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="glass-strong rounded-3xl p-12 text-center max-w-md w-full animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary grid place-items-center mb-6 glow-primary">
          <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold mb-3">Payment received</h1>
        <p className="text-muted-foreground mb-6">
          {sessionId
            ? "Your Cloud X workspace will be provisioned shortly. We'll be in touch within 24 hours."
            : "No session info was returned, but if your card was charged your account is being prepared."}
        </p>
        <Link to="/" className="inline-flex items-center px-6 h-11 rounded-md bg-gradient-primary text-primary-foreground font-semibold">
          Back to home
        </Link>
      </div>
    </main>
  );
}
