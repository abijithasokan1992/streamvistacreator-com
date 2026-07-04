import { useEffect, useState } from "react";
import { Database, Loader2, Send, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Handoff = "courier" | "in_person" | "pickup_request";
type DriveInterface = "usb_c" | "thunderbolt" | "usb_a" | "sata" | "nvme" | "other";
type FsKind = "exfat" | "ntfs" | "hfs_plus" | "apfs" | "ext4" | "other";

type Row = {
  id: string;
  drive_label: string;
  project_title: string | null;
  status: string;
  handoff_method: string;
  courier_tracking: string | null;
  expected_arrival: string | null;
  drive_capacity_gb: number | null;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  received: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  ingesting: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  ingested: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  returned: "bg-secondary/30 text-muted-foreground border-border/50",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  received: "Received",
  ingesting: "Ingesting",
  ingested: "Ingested",
  returned: "Returned",
  rejected: "Rejected",
};

const INTERFACE_LABEL: Record<DriveInterface, string> = {
  usb_c: "USB-C",
  thunderbolt: "Thunderbolt",
  usb_a: "USB-A",
  sata: "SATA",
  nvme: "NVMe",
  other: "Other",
};

const FS_LABEL: Record<FsKind, string> = {
  exfat: "exFAT",
  ntfs: "NTFS",
  hfs_plus: "HFS+",
  apfs: "APFS",
  ext4: "ext4",
  other: "Other",
};

const HANDOFF_LABEL: Record<Handoff, string> = {
  courier: "Courier (we receive at studio HQ)",
  in_person: "Hand-deliver in person",
  pickup_request: "Request StreamVista pickup",
};

const EMPTY = {
  project_title: "",
  drive_label: "",
  drive_serial: "",
  drive_capacity_gb: "",
  estimated_content_gb: "",
  drive_interface: "usb_c" as DriveInterface,
  filesystem: "exfat" as FsKind,
  handoff_method: "courier" as Handoff,
  courier_tracking: "",
  expected_arrival: "",
  contact_name: "",
  contact_phone: "",
  pickup_address: "",
  notes: "",
};

export default function HardDiskIntakeDialog({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const loadRows = async () => {
    if (!user) return;
    setLoadingRows(true);
    const { data } = await supabase
      .from("hard_disk_intakes" as any)
      .select("id,drive_label,project_title,status,handoff_method,courier_tracking,expected_arrival,drive_capacity_gb,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setRows(((data as unknown) as Row[]) ?? []);
    setLoadingRows(false);
  };

  useEffect(() => {
    if (open) loadRows();
  }, [open, user?.id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    if (!form.drive_label.trim()) {
      toast.error("Drive label is required.");
      return;
    }
    if (form.handoff_method === "courier" && !form.courier_tracking.trim()) {
      toast.error("Courier tracking number is required for courier handoff.");
      return;
    }
    if (form.handoff_method === "pickup_request" && !form.pickup_address.trim()) {
      toast.error("Pickup address is required for pickup requests.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("hard_disk_intakes" as any).insert({
      user_id: user.id,
      project_title: form.project_title.trim() || null,
      drive_label: form.drive_label.trim(),
      drive_serial: form.drive_serial.trim() || null,
      drive_capacity_gb: form.drive_capacity_gb ? Number(form.drive_capacity_gb) : null,
      estimated_content_gb: form.estimated_content_gb ? Number(form.estimated_content_gb) : null,
      drive_interface: form.drive_interface,
      filesystem: form.filesystem,
      handoff_method: form.handoff_method,
      courier_tracking: form.courier_tracking.trim() || null,
      expected_arrival: form.expected_arrival || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      pickup_address: form.pickup_address.trim() || null,
      notes: form.notes.trim() || null,
      status: "submitted",
    } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Hard-disk intake submitted. Ops team will confirm shortly.");
    setForm(EMPTY);
    loadRows();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors p-4 flex flex-col gap-1.5 text-left"
          }
        >
          <span className="flex items-center gap-2 text-accent">
            <Database className="w-4 h-4" />
            <span className="font-medium text-foreground">Hard-disk Import</span>
          </span>
          <span className="text-xs text-muted-foreground">Record physical intake</span>
        </button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-accent" /> Hard-disk Import Intake
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Log a physical drive shipment so our ops team can receive and ingest it into your vault. You'll get status updates as it moves through received → ingesting → ingested.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Project title (optional)">
              <Input
                value={form.project_title}
                onChange={(e) => set("project_title", e.target.value)}
                placeholder="e.g. Feature_X master OCN"
                maxLength={200}
              />
            </Field>
            <Field label="Drive label *">
              <Input
                value={form.drive_label}
                onChange={(e) => set("drive_label", e.target.value)}
                placeholder="e.g. SANDISK_PRO_4TB_01"
                maxLength={120}
              />
            </Field>
            <Field label="Drive serial">
              <Input
                value={form.drive_serial}
                onChange={(e) => set("drive_serial", e.target.value)}
                placeholder="Manufacturer serial"
                maxLength={120}
              />
            </Field>
            <Field label="Capacity (GB)">
              <Input
                type="number"
                min={0}
                value={form.drive_capacity_gb}
                onChange={(e) => set("drive_capacity_gb", e.target.value)}
                placeholder="e.g. 4000"
              />
            </Field>
            <Field label="Estimated content size (GB)">
              <Input
                type="number"
                min={0}
                value={form.estimated_content_gb}
                onChange={(e) => set("estimated_content_gb", e.target.value)}
                placeholder="e.g. 1800"
              />
            </Field>
            <Field label="Interface">
              <Select
                value={form.drive_interface}
                onValueChange={(v) => set("drive_interface", v as DriveInterface)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(INTERFACE_LABEL) as DriveInterface[]).map((k) => (
                    <SelectItem key={k} value={k}>{INTERFACE_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Filesystem">
              <Select
                value={form.filesystem}
                onValueChange={(v) => set("filesystem", v as FsKind)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FS_LABEL) as FsKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{FS_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Handoff method *">
              <Select
                value={form.handoff_method}
                onValueChange={(v) => set("handoff_method", v as Handoff)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(HANDOFF_LABEL) as Handoff[]).map((k) => (
                    <SelectItem key={k} value={k}>{HANDOFF_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.handoff_method === "courier" && (
              <>
                <Field label="Courier tracking number *">
                  <Input
                    value={form.courier_tracking}
                    onChange={(e) => set("courier_tracking", e.target.value)}
                    placeholder="AWB / tracking ID"
                    maxLength={120}
                  />
                </Field>
                <Field label="Expected arrival">
                  <Input
                    type="date"
                    value={form.expected_arrival}
                    onChange={(e) => set("expected_arrival", e.target.value)}
                  />
                </Field>
              </>
            )}

            {form.handoff_method === "pickup_request" && (
              <Field label="Pickup address *" className="sm:col-span-2">
                <Textarea
                  value={form.pickup_address}
                  onChange={(e) => set("pickup_address", e.target.value)}
                  rows={2}
                  placeholder="Full address including landmark, city and PIN"
                  maxLength={500}
                />
              </Field>
            )}

            <Field label="On-site contact name">
              <Input
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="On-site contact phone">
              <Input
                value={form.contact_phone}
                onChange={(e) => set("contact_phone", e.target.value)}
                placeholder="+91 …"
                maxLength={40}
              />
            </Field>

            <Field label="Notes for ops" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Folder structure, sidecar files, encryption / password, return preference, anything we should know."
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Submit intake
            </Button>
          </div>

          {/* Recent intakes */}
          <div className="pt-2 border-t border-border/40">
            <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
              Recent intakes
            </h4>
            {loadingRows ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No intakes yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border/40 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{r.drive_label}</p>
                      <p className="text-muted-foreground truncate">
                        {r.project_title ?? "—"}
                        {r.drive_capacity_gb ? ` · ${r.drive_capacity_gb} GB` : ""}
                        {r.courier_tracking ? ` · AWB ${r.courier_tracking}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-widest font-mono border rounded-full px-2 py-0.5 ${
                        STATUS_TONE[r.status] ?? STATUS_TONE.submitted
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
