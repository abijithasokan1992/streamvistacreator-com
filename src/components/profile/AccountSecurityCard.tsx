import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { KeyRound, Mail } from "lucide-react";

export function AccountSecurityCard() {
  const { user } = useAuth();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const updatePassword = async () => {
    if (pwd.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated.");
      setPwd("");
    }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Reset email sent.");
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Account & Security</h3>
      </div>
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email</Label>
        <Input value={user?.email ?? ""} readOnly className="bg-muted/30" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">New password</Label>
        <div className="flex gap-2">
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Min 8 characters" />
          <Button onClick={updatePassword} disabled={busy || !pwd}>Update</Button>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={sendReset} disabled={busy}>
        Send password reset email
      </Button>
    </Card>
  );
}
