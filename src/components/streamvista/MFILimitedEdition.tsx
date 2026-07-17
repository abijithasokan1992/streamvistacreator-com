import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, Upload, ShieldCheck, Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TOTAL_SEATS = 500;

const MFI_ROLES = [
  "Director",
  "Producer",
  "Cinematographer",
  "Editor",
  "Production House",
  "VFX / Post Artist",
  "Independent Filmmaker",
  "Actor",
  "Other",
];

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const Schema = z.object({
  clientName: z.string().trim().min(2, "Name required").max(200),
  professionalRole: z.string().min(1, "Select your role"),
  whatsapp: z.string().trim().min(7, "WhatsApp number required").max(30),
  email: z.string().trim().email("Valid email required").max(255).or(z.literal("")),
});

export const MFILimitedEdition = () => {
  const [seatsTaken, setSeatsTaken] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [role, setRole] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc("mfi_seats_taken").then(({ data, error }) => {
      if (!error && typeof data === "number") setSeatsTaken(data);
    });
  }, []);

  const seatsLeft = seatsTaken === null ? null : Math.max(0, TOTAL_SEATS - seatsTaken);
  const soldOut = seatsLeft === 0;

  const handleFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (!ACCEPT.split(",").includes(f.type)) {
      toast.error("Upload a JPG, PNG, WEBP or PDF");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File must be under 5 MB");
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soldOut) return;

    const parsed = Schema.safeParse({ clientName, professionalRole: role, whatsapp, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!file) {
      toast.error("Please upload your MFI membership proof");
      return;
    }

    setSubmitting(true);

    const requestId = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${requestId}/proof.${ext}`;

    // Insert the onboarding request FIRST so the storage RLS on `mfi-proof`,
    // which requires the path's UUID prefix to match an existing
    // onboarding_requests.id, permits the upload.
    const { error: insertErr } = await supabase
      .from("onboarding_requests")
      .insert({
        id: requestId,
        client_name: parsed.data.clientName,
        professional_role: parsed.data.professionalRole,
        contact_phone: parsed.data.whatsapp,
        business_email: parsed.data.email || null,
        selected_cycle: "creator",
        base_price: 0,
        final_price: 0,
        plan_type: "mfi_limited",
        onboarding_status: "pending",
        mfi_proof_path: path,
      });

    if (insertErr) {
      console.error("MFI insert error", insertErr);
      setSubmitting(false);
      toast.error("Submission failed. Please try again.");
      return;
    }

    // Now upload the proof file bound to the request id.
    const { error: upErr } = await supabase.storage
      .from("mfi-proof")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (upErr) {
      console.error("MFI upload error", upErr);
      setSubmitting(false);
      toast.error("Upload failed. Please try again.");
      return;
    }


    setSubmitting(false);
    setDone(true);
    toast.success("You're on the list — admin review within 24 hours.");
  };

  return (
    <section id="mfi-free" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="container max-w-6xl relative">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-start">
          {/* Pitch */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-[11px] uppercase tracking-[0.25em] font-mono-tech mb-6">
              <Sparkles className="w-3 h-3" /> Limited Edition · Free
            </div>
            <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl mb-6">
              For Malayalam<br />
              <span className="gradient-text">Film Industry.</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md mb-8">
              We're handing 500 free StreamVista Creator workspaces to verified MFI creators.
              Pay-as-you-go after onboarding · ₹1000 refundable security deposit ·
              no card needed to apply.
            </p>

            {/* Seats counter */}
            <div className="glass rounded-2xl p-5 max-w-sm">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <span>Seats remaining</span>
                <span className="text-accent font-mono-tech">
                  {seatsLeft === null ? "…" : `${seatsLeft}/${TOTAL_SEATS}`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-gradient-primary transition-all duration-700"
                  style={{
                    width:
                      seatsLeft === null
                        ? "0%"
                        : `${((TOTAL_SEATS - seatsLeft) / TOTAL_SEATS) * 100}%`,
                  }}
                />
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> Verified manually by admin</li>
                <li className="flex items-center gap-2"><Film className="w-4 h-4 text-accent" /> Secure cloud workspace</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-accent" /> Cancellation via admin support only</li>
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="glass-strong rounded-3xl p-7 md:p-9 animate-fade-in">
            {done ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary grid place-items-center mb-5 glow-primary">
                  <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-2">You're on the list</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Our team will verify your MFI proof and reach you on WhatsApp within 24 hours.
                </p>
              </div>
            ) : soldOut ? (
              <div className="text-center py-10">
                <div className="font-display text-2xl font-bold mb-2">All 500 seats claimed</div>
                <p className="text-muted-foreground text-sm">
                  Standard StreamVista Creator plans below remain open with full GST invoicing.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-xs uppercase tracking-[0.2em] text-accent">Apply free · MFI verification</div>

                <div className="space-y-2">
                  <Label htmlFor="mfi-name" className="text-xs uppercase tracking-wider text-muted-foreground">Full name</Label>
                  <Input id="mfi-name" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="As on your ID" className="bg-input/60 h-12" required maxLength={200} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger className="bg-input/60 h-12"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{MFI_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mfi-wa" className="text-xs uppercase tracking-wider text-muted-foreground">WhatsApp</Label>
                    <Input id="mfi-wa" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+91 98xxxxxx" className="bg-input/60 h-12" required maxLength={30} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mfi-email" className="text-xs uppercase tracking-wider text-muted-foreground">Email <span className="opacity-50">(optional)</span></Label>
                  <Input id="mfi-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" className="bg-input/60 h-12" maxLength={255} />
                </div>

                {/* Upload */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    MFI / FEFKA / KFCC membership proof
                  </Label>
                  <label
                    htmlFor="mfi-upload"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors px-6 py-7 text-center",
                      file
                        ? "border-accent bg-accent/5"
                        : "border-border bg-input/40 hover:border-accent/60"
                    )}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    {file ? (
                      <>
                        <span className="text-sm font-medium text-foreground">{file.name}</span>
                        <span className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · click to replace</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-foreground">Upload ID / membership card</span>
                        <span className="text-[11px] text-muted-foreground">JPG, PNG, WEBP or PDF · max 5 MB</span>
                      </>
                    )}
                    <input
                      id="mfi-upload"
                      type="file"
                      accept={ACCEPT}
                      className="sr-only"
                      onChange={e => handleFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 rounded-xl bg-gradient-primary text-primary-foreground font-display font-semibold glow-primary hover:scale-[1.01] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>) : (<>Claim my free seat →</>)}
                </button>

                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Submitting does not charge you. The ₹1000 refundable deposit is
                  collected only after admin verification, before activation.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
