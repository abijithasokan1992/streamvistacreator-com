import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StorageGrantPanel from "./StorageGrantPanel";
import { HardDrive } from "lucide-react";

/**
 * Admin wrapper around <StorageGrantPanel>: pick a user (by user_id) and
 * grant / reduce / set their bonus storage. The picker is intentionally
 * lightweight — for richer lookups, use the User Directory sub-section
 * and copy the user_id into this panel.
 */
export default function StorageTopUpsPanel() {
  const [userId, setUserId] = useState("");

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent grid place-items-center">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold">Storage Top-ups</div>
            <div className="text-xs text-muted-foreground">
              Adjust bonus storage (GB) for a specific user. Look up their <code>user_id</code>
              in User Directory.
            </div>
          </div>
        </div>
        <div className="max-w-xl">
          <Label htmlFor="topup-user-id" className="text-xs">Target user ID</Label>
          <Input
            id="topup-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value.trim())}
            placeholder="uuid… (from user_profiles.user_id)"
            className="font-mono text-xs"
          />
        </div>
      </div>
      {userId ? (
        <StorageGrantPanel userId={userId} />
      ) : (
        <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Enter a user ID above to load their storage entitlement.
        </div>
      )}
    </div>
  );
}
