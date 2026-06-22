import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Unlock } from "lucide-react";
import { toast } from "sonner";

const SECTIONS = [
  { key: "basic_metadata", label: "Basic metadata" },
  { key: "synopsis", label: "Synopsis / notes" },
  { key: "cast_crew", label: "Cast & crew" },
  { key: "legal_documents", label: "Legal documents" },
  { key: "master_file", label: "Master file" },
  { key: "trailer", label: "Trailer" },
  { key: "poster", label: "Poster" },
  { key: "subtitles_audio", label: "Subtitles / audio" },
  { key: "rights", label: "Rights metadata" },
  { key: "delivery", label: "Delivery metadata" },
];

/**
 * Creator-facing button shown on locked titles. Files a `title_edit_requests` row
 * via RPC `creator_request_title_edit`. Admin approves and unlocks selected sections.
 */
export default function RequestEditButton({ titleId, disabled }: { titleId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("metadata_correction");
  const [message, setMessage] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) =>
    setSections(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);

  const submit = async () => {
    if (!message.trim()) { toast.error("Add a short note for the reviewer"); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc("creator_request_title_edit", {
      _title_id: titleId,
      _request_type: type,
      _message: message,
      _sections: sections,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Edit request sent to StreamVista admin");
    setOpen(false);
    setMessage(""); setSections([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Unlock className="w-3.5 h-3.5 mr-1.5" /> Request edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request edit on locked title</DialogTitle>
          <DialogDescription>
            Title sections lock once submitted. Tell our review team what you need to change and which sections to reopen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Request type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="metadata_correction">Metadata correction</SelectItem>
                <SelectItem value="asset_replacement">Asset replacement</SelectItem>
                <SelectItem value="subtitle_audio_update">Subtitle / audio update</SelectItem>
                <SelectItem value="legal_document_replacement">Legal document replacement</SelectItem>
                <SelectItem value="rights_clarification">Rights clarification</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sections to reopen</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-40 overflow-auto pr-1">
              {SECTIONS.map(s => (
                <label key={s.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={sections.includes(s.key)} onCheckedChange={() => toggle(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Note to reviewer</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Why this edit is needed…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
