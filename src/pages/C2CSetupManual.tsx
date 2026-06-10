import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, Cpu, Wifi, Bluetooth, Radio, CheckCircle2,
  ArrowRight, Monitor, Video, Settings2, Cloud, Layers, Cable,
  Smartphone, Globe, ShieldCheck, Copy, ChevronDown, ChevronUp,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PAR_URL = "https://objectstorage.ap-mumbai-1.oraclecloud.com/p/JeKB364pUi17Y_pIPaqVDc_M6XMrsCdj0xUXOHkWJT-2sOgzisRkuAB1KzAtfmym/n/bma8wibnommg/b/bucket-20260526-1544/o/";

/* ─────────────── Types ─────────────── */
type Step = {
  number: number;
  title: string;
  body: string;
  details?: string[];
  icon: React.ElementType;
};

type Category = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  steps: Step[];
  tools: string[];
};

/* ─────────────── Data ─────────────── */
const CATEGORIES: Category[] = [
  {
    id: "hardware",
    label: "Dedicated Hardware Encoders",
    icon: Cpu,
    description:
      "Standalone encoder boxes (Atomos, Blackmagic, LiveU, etc.) that capture SDI/HDMI and push directly to the cloud via Ethernet, Wi-Fi or 4G/5G.",
    tools: ["Atomos Connect", "Blackmagic Web Presenter", "LiveU Solo", "Dejero GateWay"],
    steps: [
      {
        number: 1,
        title: "Physical Connection",
        body: "Attach your camera to the encoder via SDI or HDMI. Ensure the signal is clean at up to 4K60p before any cloud hand-off.",
        details: ["Use shielded SDI for runs >10 m", "Verify 3G-SDI / 12G-SDI level on long cable runs"],
        icon: Cable,
      },
      {
        number: 2,
        title: "Network Uplink",
        body: "Plug Ethernet into the encoder, or bond multiple LTE/5G modems for field redundancy.",
        details: ["RJ-45 Gigabit preferred", "Wi-Fi 6E fallback for roaming rigs"],
        icon: Cable,
      },
      {
        number: 3,
        title: "Target Configuration",
        body: "In the encoder dashboard, set the destination to StreamVista’s Oracle OCI PAR endpoint.",
        details: ["Region: ap-mumbai-1", "Bucket: bucket-20260526-1544"],
        icon: Globe,
      },
      {
        number: 4,
        title: "Auto-Ingest",
        body: "Press Record / Stream on the encoder. The file segments are written in real time to the 03-RAW-INGEST prefix inside the OCI bucket.",
        details: ["Checksum verification on each segment", "Auto-retry on network blip"],
        icon: Cloud,
      },
    ],
  },
  {
    id: "mobile",
    label: "Mobile Ingest (iOS / Android)",
    icon: Smartphone,
    description:
      "Use a phone or tablet as a field encoder. Pair an external camera over USB-C/Lightning or capture directly from the device lens.",
    tools: ["FiLMiC Pro", "Larix Broadcaster", "Airmix", "Streamlabs Mobile"],
    steps: [
      {
        number: 1,
        title: "Camera Source",
        body: "Choose the built-in lens, or connect an external camera / HDMI dongle to the phone.",
        details: ["USB-C capture cards supported on Android", "Lightning-to-HDMI for iOS rigs"],
        icon: Video,
      },
      {
        number: 2,
        title: "Bonded Network",
        body: "Enable Wi-Fi + Cellular bonding so the stream survives hand-offs between towers.",
        details: ["Use 5 GHz Wi-Fi when available", "Disable battery optimisation for ingest apps"],
        icon: Wifi,
      },
      {
        number: 3,
        title: "Endpoint Setup",
        body: "Paste the StreamVista OCI PAR URL into the app’s custom RTMP / S3 destination.",
        details: ["Path format: …/o/{filename}", "Use UUID filenames to avoid collisions"],
        icon: Globe,
      },
      {
        number: 4,
        title: "Background Upload",
        body: "Hit Go Live or Record. Clips upload progressively in the background to 03-RAW-INGEST.",
        details: ["Resume on disconnect supported", "H.264 / HEVC auto-transmux"],
        icon: Cloud,
      },
    ],
  },
  {
    id: "ndi",
    label: "NDI / IP Workflow",
    icon: Radio,
    description:
      "High-efficiency IP transmission over local LAN. Send uncompressed or lightly compressed video from NDI-enabled cameras straight into an ingest node.",
    tools: ["NDI Tools (Studio Monitor)", "vMix", "OBS + NDI Plugin", "SRT / RIST bridges"],
    steps: [
      {
        number: 1,
        title: "NDI Discovery",
        body: "Ensure camera and ingest PC are on the same multicast-capable subnet. The source will auto-appear in NDI Studio Monitor.",
        details: ["IGMP snooping enabled on switch", "Avoid Wi-Fi for multichannel NDI HX3"],
        icon: Monitor,
      },
      {
        number: 2,
        title: "Receive & Encode",
        body: "Launch your NDI receiver app, select the source, and set output to the desired codec (ProRes, H.265, etc.).",
        details: ["HX3 for bandwidth-constrained links", "Full NDI for studio LAN"],
        icon: Settings2,
      },
      {
        number: 3,
        title: "Bridge to Cloud",
        body: "Route the encoded feed into the StreamVista upload agent, pointing at the OCI PAR endpoint.",
        details: ["Local loop-back (127.0.0.1) if agent is on same machine", "RTMP local relay optional"],
        icon: Globe,
      },
      {
        number: 4,
        title: "Bucket Ingest",
        body: "The agent segments and uploads each GOP-boundary chunk directly to bucket-20260526-1544 under 03-RAW-INGEST.",
        details: ["Segment size: 10 s default", "SHA-256 per segment"],
        icon: Cloud,
      },
    ],
  },
  {
    id: "virtual",
    label: "Virtual Hardware & Software Encoders",
    icon: Layers,
    badge: "NEW",
    description:
      "Software-based encoding stacks (OBS Studio, Streambox, NDI Router) running on macOS, Windows or Linux. Receive camera feeds over Bluetooth, Wi-Fi or Ethernet up to 8K / 12K and push raw audio/video straight to Oracle Cloud.",
    tools: ["OBS Studio", "Streambox", "NDI Router", "vMix", "Wirecast", "FFmpeg"],
    steps: [
      {
        number: 1,
        title: "Signal Acquisition",
        body: "Connect your camera to the workstation via Bluetooth, Wi-Fi, Ethernet or USB. Resolutions up to 8K / 12K are supported when the camera and link bandwidth allow.",
        details: [
          "Bluetooth: low-latency control + preview proxy (not primary video)",
          "Wi-Fi 6E / 7: 8K60p ProRes over 160 MHz channel bonded links",
          "Ethernet 10 GbE: 12K RAW or uncompressed RGB without compression",
          "USB4 / Thunderbolt 4: 8K HDMI 2.1 capture via external dongle",
        ],
        icon: Cable,
      },
      {
        number: 2,
        title: "Encoder Configuration",
        body: "In OBS Studio, Streambox or your virtual encoder, create a new output profile targeting the StreamVista ingest pipeline.",
        details: [
          "Format: Matroska (.mkv) or MOV for fault tolerance",
          "Codecs: ProRes 422 HQ / H.265 10-bit / DNxHR / uncompressed",
          "Audio: 48 kHz 24-bit PCM or 32-bit float",
          "Enable ‘Custom Output’ → ‘S3 / HTTP PUT’ mode",
        ],
        icon: Settings2,
      },
      {
        number: 3,
        title: "PAR URL Target",
        body: "Set the destination URL to the StreamVista Oracle OCI Pre-Authenticated Request (PAR) endpoint. The app will PUT each segment or complete file directly to the bucket.",
        details: [
          "Use the PAR base URL below and append your filename",
          "Enable chunked transfer for files > 5 GB",
          "Set retry policy: 3 attempts with exponential backoff",
        ],
        icon: Globe,
      },
      {
        number: 4,
        title: "Auto-Ingest to 03-RAW-INGEST",
        body: "Start recording / streaming. Raw audio/video is automatically segmented, checksummed and uploaded into the Oracle Cloud ‘03-RAW-INGEST’ folder inside bucket-20260526-1544.",
        details: [
          "Folder prefix: 03-RAW-INGEST/{date}/{filename}",
          "ETag verification on every PUT completes the ingest handshake",
          " failed chunks retry automatically; success triggers a webhook to StreamVista",
        ],
        icon: Cloud,
      },
    ],
  },
];

/* ─────────────── Components ─────────────── */
function CopyUrlButton() {
  const handleCopy = () => {
    navigator.clipboard.writeText(PAR_URL);
    toast.success("PAR URL copied to clipboard");
  };

  return (
    <button
      onClick={handleCopy}
      className="group inline-flex items-center gap-2 rounded-lg bg-secondary/60 border border-border/60 px-3 py-2 text-xs font-mono-tech break-all hover:bg-secondary transition"
    >
      <span className="truncate max-w-[260px] sm:max-w-[420px] md:max-w-[560px]">{PAR_URL}</span>
      <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent shrink-0" />
    </button>
  );
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="relative pl-8 sm:pl-10 border-l border-border/40 pb-8 last:pb-0">
      {/* timeline dot */}
      <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-primary grid place-items-center glow-primary">
        <span className="text-[10px] font-bold text-primary-foreground">{step.number}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent" />
          <h4 className="font-display text-base font-bold">{step.title}</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        {step.details && (
          <ul className="space-y-1.5 mt-2">
            {step.details.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent/70 shrink-0 mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ cat }: { cat: Category }) {
  const [open, setOpen] = useState(false);
  const Icon = cat.icon;

  return (
    <article
      className={`glass-strong rounded-2xl border transition-all overflow-hidden ${
        cat.id === "virtual"
          ? "border-accent/40 shadow-[0_0_60px_-20px_hsl(var(--accent)/0.3)]"
          : "border-border/40 hover:border-primary/30"
      }`}
    >
      {/* header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left"
      >
        <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${
          cat.id === "virtual" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-bold truncate">{cat.label}</h3>
            {cat.badge && (
              <Badge className="bg-accent/15 text-accent border-accent/30 text-[10px] uppercase tracking-wider">
                {cat.badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
        </div>
        <div className="shrink-0">
          {open ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* body */}
      {open && (
        <div className="px-5 sm:px-6 pb-6 pt-0 animate-fade-in">
          {/* tools */}
          <div className="flex flex-wrap gap-2 mb-5">
            {cat.tools.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border/50 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <Monitor className="w-3 h-3 text-primary/70" />
                {t}
              </span>
            ))}
          </div>

          {/* steps */}
          <div className="space-y-0">
            {cat.steps.map((s) => (
              <StepCard key={s.number} step={s} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/* ─────────────── Page ─────────────── */
export default function C2CSetupManual() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">C2C Setup Manual</div>
              <div className="text-[11px] text-muted-foreground">Camera-to-Cloud Ingest Guides</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/studio"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
            >
              Studio <ExternalLink className="w-3 h-3" />
            </Link>
            <Link
              to="/ingest-test"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
            >
              Ingest Test <ExternalLink className="w-3 h-3" />
            </Link>
            <Link
              to="/"
              className="px-3 py-2 text-sm rounded-md border border-border/60 hover:bg-secondary inline-flex items-center gap-2"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-10 max-w-4xl space-y-8">
        {/* Hero */}
        <section className="relative glass-strong rounded-3xl p-8 md:p-10 overflow-hidden border border-border/40">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                StreamVista Bridge Workflow
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-3">
              Camera-to-Cloud
              <br />
              <span className="gradient-text">Setup Manual</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              End-to-end guides for every ingest path — hardware, mobile, NDI and virtual software encoders.
              All routes land in Oracle OCI bucket <span className="text-accent font-semibold">03-RAW-INGEST</span>.
            </p>
          </div>
        </section>

        {/* PAR URL strip */}
        <section className="glass rounded-2xl p-5 border border-border/40 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Cloud className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider">Oracle OCI PAR URL</span>
          </div>
          <CopyUrlButton />
        </section>

        {/* Categories */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Ingest Categories
            </span>
          </div>
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </section>

        {/* CTA */}
        <section className="glass rounded-2xl p-6 border border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold mb-1">Ready to test your ingest?</h3>
            <p className="text-sm text-muted-foreground">
              Use the drag-and-drop uploader to verify your PAR URL and bucket connectivity.
            </p>
          </div>
          <Link
            to="/ingest-test"
            className="cta-guide h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary inline-flex items-center justify-center gap-2 shrink-0"
          >
            Open Ingest Test <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* Footer hint */}
        <p className="text-center text-[11px] text-muted-foreground/60 pb-8">
          All uploads are SHA-256 verified and encrypted in transit. For support, visit the{" "}
          <Link to="/support" className="underline hover:text-accent transition">Support Center</Link>.
        </p>
      </main>
    </div>
  );
}
