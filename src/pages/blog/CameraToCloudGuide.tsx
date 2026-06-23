import { Link } from "react-router-dom";
import { ArrowRight, Cloud, Smartphone, Cpu, Radio, Layers, CheckCircle2, ShieldCheck, Wallet } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";

const PUBLISHED = "2026-06-23";
const URL_PATH = "/blog/camera-to-cloud-guide";

export default function CameraToCloudGuide() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo
        title="Camera to Cloud Workflow Guide for Indie Filmmakers — StreamVista"
        description="A practical Camera to Cloud (C2C) workflow guide for indie filmmakers and small crews — compare hardware encoders, mobile rigs, NDI and software encoders, and ship dailies to the cloud cheaply."
        path={URL_PATH}
        type="article"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Camera to Cloud Workflow Guide for Indie Filmmakers",
            datePublished: PUBLISHED,
            dateModified: PUBLISHED,
            author: { "@type": "Organization", name: "StreamVista" },
            publisher: {
              "@type": "Organization",
              name: "StreamVista",
              url: "https://streamvistacreator.com/",
            },
            mainEntityOfPage: `https://streamvistacreator.com${URL_PATH}`,
            description:
              "Step-by-step camera to cloud (C2C) workflow guide for independent film productions, covering encoders, networking, ingest, and cost-effective tooling.",
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://streamvistacreator.com/" },
              { "@type": "ListItem", position: 2, name: "Guides", item: "https://streamvistacreator.com/blog" },
              {
                "@type": "ListItem",
                position: 3,
                name: "Camera to Cloud Workflow",
                item: `https://streamvistacreator.com${URL_PATH}`,
              },
            ],
          },
        ]}
      />

      <Navbar />

      <article className="container max-w-3xl pt-28 pb-20">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
        >
          ← Back to StreamVista
        </Link>

        <header className="mt-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-[0.2em] text-accent mb-5">
            <Cloud className="w-3.5 h-3.5" /> Guide · Production Workflow
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Camera to Cloud Workflow for Indie Filmmakers
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            A practical guide to setting up a Camera to Cloud (C2C) pipeline for independent
            productions — what gear you actually need, how to keep costs sane, and how to ship
            dailies straight from set to your editor without a runner with a hard drive.
          </p>
          <p className="text-xs text-muted-foreground mt-4">Published {new Date(PUBLISHED).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })} · 8 min read</p>
        </header>

        <section className="prose-content space-y-10 text-sm md:text-base leading-relaxed text-muted-foreground">
          <div className="glass-strong rounded-2xl p-6 border border-border/40">
            <h2 className="font-display text-xl text-foreground font-bold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" /> TL;DR
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>A Camera to Cloud workflow moves footage from set to the cloud in near real time, so editors, colourists and producers can start work the same day.</li>
              <li>You don't need a full Atomos or Teradek rig — a phone with Larix Broadcaster and a decent uplink can drive a real C2C pipeline.</li>
              <li>The four practical paths are: dedicated hardware encoders, mobile ingest, NDI / IP, and software encoders like OBS.</li>
              <li>The cost question is mostly bandwidth + storage, not gear. Pick proxy resolutions on set and full-res transfers overnight.</li>
              <li>StreamVista's <Link to="/c2c-setup" className="text-accent underline">C2C Setup Manual</Link> is the step-by-step technical reference once you've picked a path.</li>
            </ul>
          </div>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">What "Camera to Cloud" actually means</h2>
            <p>
              Camera to Cloud (C2C) is the idea that the second a clip is recorded — or sometimes
              while it's still recording — it's encoded, uploaded and made available to the rest of
              the production team in a remote bucket. No SSDs being couriered, no overnight rsync
              from a DIT cart, no waiting for the data wrangler to wake up.
            </p>
            <p>
              The pieces that matter are: a <strong className="text-foreground">camera source</strong>,
              an <strong className="text-foreground">encoder</strong> that turns it into network-friendly
              files, a <strong className="text-foreground">network uplink</strong>, and a
              <strong className="text-foreground"> cloud destination</strong> with the right folder
              structure so editorial and post can find takes by scene and slate.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">Why indie productions should care</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong className="text-foreground">Same-day editorial.</strong> Your editor can start cutting from proxies the same evening, not three days later when the cards arrive.</li>
              <li><strong className="text-foreground">Cheaper than couriers.</strong> Hard drives, couriers and reshoots from lost footage cost more than the bandwidth on a small production.</li>
              <li><strong className="text-foreground">Backup by default.</strong> A clip is in two places (camera + cloud) before anyone touches a card.</li>
              <li><strong className="text-foreground">Remote stakeholders.</strong> Directors, producers, colourists and rights holders can review takes from anywhere on a secure link.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">Pick the right ingest path for your crew size</h2>
            <p>
              There are four practical C2C paths. Most indie shoots only need one. Pick by camera,
              location bandwidth, and how many parallel streams you need.
            </p>

            <div className="grid gap-4 mt-4">
              <PathCard
                icon={Cpu}
                title="Dedicated hardware encoders"
                tools="Atomos Connect, Blackmagic Web Presenter, LiveU Solo, Teradek"
                bestFor="Multi-camera shoots, live ingest, broadcasters or commercial clients who pay for the gear."
                tradeoff="Best reliability and the lowest latency, but the encoder boxes plus bonded modems get expensive fast. Overkill for a 2-person crew."
              />
              <PathCard
                icon={Smartphone}
                title="Mobile ingest (iOS / Android)"
                tools="Larix Broadcaster, FiLMiC Pro, Airmix, Streamlabs Mobile"
                bestFor="One-camera indie shoots, docs, music videos, behind-the-scenes B-roll. The cheapest real C2C path."
                tradeoff="A phone tethered to the camera over HDMI capture is a real encoder. Watch battery and thermals on long takes."
              />
              <PathCard
                icon={Radio}
                title="NDI / IP workflow"
                tools="NDI Tools, vMix, OBS + NDI Plugin, SRT bridges"
                bestFor="Studio shoots where everything is on a LAN — talk shows, podcasts, virtual production stages."
                tradeoff="Brilliant on a wired gigabit subnet, painful in the field. Don't try multichannel NDI HX over Wi-Fi."
              />
              <PathCard
                icon={Layers}
                title="Software / virtual encoders"
                tools="OBS Studio, Streambox, FFmpeg, Wirecast"
                bestFor="Anyone with a workstation on set. Lets you pick the codec, bitrate and segmentation precisely."
                tradeoff="You're responsible for the encoder profile. Get ProRes vs H.265 wrong and you'll saturate the uplink or trash the colour pipeline."
              />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">A cost-effective indie setup that works today</h2>
            <p>For a 1- to 4-person crew shooting on a mirrorless or cinema body, this is the cheapest reliable C2C stack:</p>
            <ol className="space-y-2 list-decimal pl-5">
              <li><strong className="text-foreground">Camera</strong> → clean HDMI out to a USB-C / Lightning capture dongle.</li>
              <li><strong className="text-foreground">Phone or tablet</strong> running Larix Broadcaster or Airmix as the encoder.</li>
              <li><strong className="text-foreground">Bonded uplink</strong>: Wi-Fi 6 + cellular on the phone. Keep battery optimisation off for the ingest app.</li>
              <li><strong className="text-foreground">Encoder profile</strong>: H.265 10-bit proxy at 12–20 Mbps for live ingest. Full-resolution camera files upload overnight from cards.</li>
              <li><strong className="text-foreground">Cloud destination</strong>: a pre-authenticated bucket endpoint (StreamVista uses an OCI PAR URL) that auto-files clips under <code className="font-mono-tech text-xs">03-RAW-INGEST/{`{date}/{filename}`}</code>.</li>
              <li><strong className="text-foreground">Editor</strong>: picks up proxies from the same bucket, cuts in Resolve / Premiere, conforms to camera originals later.</li>
            </ol>
            <p className="mt-3">
              That whole stack is a phone, a $30 HDMI dongle and a SIM with a data plan — versus a dedicated bonded encoder kit that starts around $2,000.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">Networking and bandwidth in the real world</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong className="text-foreground">10 Mbps up</strong> is enough for a single H.265 proxy stream at 1080p.</li>
              <li><strong className="text-foreground">25–50 Mbps up</strong> handles 4K proxies or two simultaneous 1080p cameras.</li>
              <li><strong className="text-foreground">Bonded 4G/5G</strong> beats a single congested venue Wi-Fi every time. If you can only have one, bring your own LTE.</li>
              <li><strong className="text-foreground">Always upload chunked.</strong> 5–10 second segments survive network drops; a single 40-minute file does not.</li>
              <li><strong className="text-foreground">Verify with checksums.</strong> Every chunk should be SHA-256 verified server-side before the editor touches it.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">Security and rights protection</h2>
            <p className="flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <span>
                Camera to Cloud means your unreleased footage lives on someone else's infrastructure
                the moment it's shot. For indie productions handling pre-release material, the
                non-negotiables are: encryption in transit (TLS), pre-authenticated upload URLs that
                expire, region-locked buckets (e.g. India-resident storage for Indian productions),
                watermarked review links for outside reviewers, and full access logs on every
                playback. StreamVista bakes these into the C CLOUD pipeline by default.
              </span>
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">Where to go next</h2>
            <p className="flex items-start gap-2">
              <Wallet className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <span>
                Once you've picked your ingest path, the
                <Link to="/c2c-setup" className="text-accent underline mx-1">StreamVista C2C Setup Manual</Link>
                walks through the exact PAR URL configuration, encoder profiles, folder structure and
                checksum verification for hardware, mobile, NDI and virtual encoders — it's the
                technical deep-dive that pairs with this guide.
              </span>
            </p>
          </section>

          <div className="glass-strong rounded-2xl p-6 border border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-10">
            <div>
              <h3 className="font-display text-lg text-foreground font-bold mb-1">Ready to wire up your first C2C ingest?</h3>
              <p className="text-sm">Open the full StreamVista setup manual and copy your workspace's PAR URL.</p>
            </div>
            <Link
              to="/c2c-setup"
              className="h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary inline-flex items-center justify-center gap-2 shrink-0"
            >
              Open C2C Setup Manual <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </article>

      <Footer />
    </main>
  );
}

function PathCard({
  icon: Icon,
  title,
  tools,
  bestFor,
  tradeoff,
}: {
  icon: React.ElementType;
  title: string;
  tools: string;
  bestFor: string;
  tradeoff: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/40">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-display text-lg text-foreground font-bold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground/80 mb-2"><strong className="text-foreground">Tools:</strong> {tools}</p>
      <p className="text-sm"><strong className="text-foreground">Best for:</strong> {bestFor}</p>
      <p className="text-sm mt-1"><strong className="text-foreground">Trade-off:</strong> {tradeoff}</p>
    </div>
  );
}
