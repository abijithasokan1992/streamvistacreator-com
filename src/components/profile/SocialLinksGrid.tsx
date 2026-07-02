import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { SocialLink } from "@/hooks/useEntityProfile";

const PLATFORMS = [
  "website", "imdb", "instagram", "youtube", "x", "linkedin",
  "facebook", "vimeo", "ott", "tv", "channel", "app_store", "play_store", "other",
];

export function SocialLinksGrid({
  socials,
  canEdit,
  onUpsert,
  onRemove,
}: {
  socials: SocialLink[];
  canEdit: boolean;
  onUpsert: (l: { id?: string; platform: string; url: string; label?: string | null }) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  const [platform, setPlatform] = useState("website");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const add = async () => {
    if (!url.trim()) return;
    await onUpsert({ platform, url: url.trim(), label: label.trim() || null });
    setUrl(""); setLabel("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {socials.length === 0 && (
          <p className="text-xs text-muted-foreground">No links added yet.</p>
        )}
        {socials.map((l) => (
          <div key={l.id} className="flex items-center gap-2 text-sm rounded-md border border-border/40 p-2">
            <span className="text-xs uppercase text-muted-foreground w-20 shrink-0">{l.platform}</span>
            <a className="text-primary hover:underline truncate flex-1" href={l.url} target="_blank" rel="noreferrer">
              {l.label || l.url}
            </a>
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => onRemove(l.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="grid grid-cols-12 gap-2 items-end pt-2 border-t border-border/30">
          <div className="col-span-12 md:col-span-3">
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 md:col-span-3">
            <Label className="text-xs">Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Official site" />
          </div>
          <div className="col-span-12 md:col-span-5">
            <Label className="text-xs">URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="col-span-12 md:col-span-1">
            <Button type="button" onClick={add} className="w-full"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
