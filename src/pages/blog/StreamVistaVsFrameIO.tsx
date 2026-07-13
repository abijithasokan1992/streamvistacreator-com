import { Link } from "react-router-dom";
import { ArrowRight, Clapperboard, ShieldCheck, IndianRupee, Globe, CheckCircle2, XCircle, Scale } from "lucide-react";
import { Navbar } from "@/components/streamvista/Navbar";
import { Footer } from "@/components/streamvista/Footer";
import { Seo } from "@/components/Seo";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";

const PUBLISHED = "2026-06-24";
const URL_PATH = "/blog/streamvista-vs-frame-io-camera-to-cloud";

export default function StreamVistaVsFrameIO() {
  const payg = useCreatorPaygPrice();
  const priceLine = payg.resolved
    ? `StreamVista Creator Basic is free forever. Need more? The 1 TB pay-as-you-go add-on is ${payg.totalLabel}/month inclusive of GST.`
    : "StreamVista Creator Basic is free forever. Need more? The 1 TB pay-as-you-go add-on is billed at the live plan rate straight from our pricing table — no hidden calculator.";

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo
        title="StreamVista vs Frame.io for Camera to Cloud — The Best Frame.io Alternative"
        description="Looking for a Frame.io alternative? Compare Camera to Cloud (C2C) workflows, pricing, rights management, and data residency. StreamVista is the Indian-made intake-to-deal platform built for cinema operators."
        path={URL_PATH}
        type="article"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "StreamVista vs Frame.io for Camera to Cloud (C2C)",
            datePublished: PUBLISHED,
            dateModified: PUBLISHED,
            author: { "@type": "Organization", name: "StreamVista" },
            publisher: {
              "@type": "Organization",
              name: "StreamVista",
              url: "https://streamvista.in/",
            },
            mainEntityOfPage: `https://streamvista.in${URL_PATH}`,
            description:
              "A head-to-head comparison of StreamVista and Frame.io for Camera to Cloud workflows, pricing, rights management, and data residency for Indian film productions.",
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://streamvista.in/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://streamvista.in/blog" },
              {
                "@type": "ListItem",
                position: 3,
                name: "StreamVista vs Frame.io",
                item: `https://streamvista.in${URL_PATH}`,
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
          <div className="inline-flex items-center gap-2 mb-5 pill-attention">
            <Scale className="w-3.5 h-3.5" /> Comparison · Camera to Cloud
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black mb-4 leading-[1.02] tracking-tight">
            StreamVista vs <span className="gradient-text">Frame.io</span> for Camera to Cloud
          </h1>
          <p className="text-text-secondary text-base md:text-lg leading-relaxed font-medium">
            A practical comparison for Indian filmmakers and cinema operators searching for a
            Frame.io alternative. We break down Camera to Cloud workflow, rights handling,
            pricing, and where each platform actually wins.
          </p>
          <p className="text-[10px] text-text-tertiary mt-4 font-mono-tech uppercase tracking-[0.22em]">
            Published {new Date(PUBLISHED).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })} · 7 min read
          </p>
        </header>


        <section className="prose-content space-y-10 text-sm md:text-base leading-relaxed text-muted-foreground">
          <div className="glass-strong rounded-2xl p-6 border border-border/40">
            <h2 className="font-display text-xl text-foreground font-bold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" /> TL;DR
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong className="text-foreground">Frame.io</strong> is a polished review-and-approval layer owned by Adobe. Excellent for dailies comments, but it stops at the upload — it does not handle rights licensing, revenue share, or Indian data residency.
              </li>
              <li>
                <strong className="text-foreground">StreamVista</strong> is an intake-to-deal platform: Camera to Cloud ingest, storage, screening, rights management, and monetisation in one Indian-hosted pipeline.
              </li>
              <li>
                If your production needs C2C proxies today and a licensing deal tomorrow, StreamVista is the only tool on this list that covers both without exporting CSVs to a lawyer.
              </li>
              <li>
                {priceLine}
              </li>
            </ul>
          </div>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">
              What Frame.io does well — and where it ends
            </h2>
            <p>
              Frame.io revolutionised video review. Upload a ProRes proxy, share a link with a
              producer, draw a circle around a boom mic, and mark it resolved. That workflow is
              smooth, colour-accurate, and deeply integrated into Premiere and DaVinci Resolve.
            </p>
            <p className="mt-2">
              But Frame.io is fundamentally a <strong className="text-foreground">post-production collaboration tool</strong>.
              It does not:
            </p>
            <ul className="space-y-2 list-disc pl-5 mt-2">
              <li>Manage rights contracts or chain-of-title documentation.</li>
              <li>Offer revenue-share splits between content owners, producers, and distributors.</li>
              <li>Guarantee Indian data residency for productions that must store masters in-country.</li>
              <li>Provide a built-in screening room with watermarking and geo-locking for buyers.</li>
              <li>Archive inactive raw masters to cold storage to reduce burn rate.</li>
            </ul>
            <p className="mt-2">
              For a Hollywood trailer house or a US commercial editor, those gaps do not matter.
              For an Indian indie production planning festival sales, OTT licensing, and regional
              distribution, they are the difference between a closed deal and a legal headache.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">
              StreamVista: from Camera to Cloud to signed deal
            </h2>
            <p>
              StreamVista was built around the Indian cinema operator — the creator who shoots,
              edits, screens, and licenses content across multiple windows (theatrical, OTT,
              satellite, regional). The platform treats <strong className="text-foreground">Camera to Cloud</strong> not as a
              feature, but as the first step in a commercial pipeline.
            </p>
            <div className="grid gap-4 mt-4">
              <FeatureCard
                icon={Clapperboard}
                title="C2C ingest that respects your folder structure"
                body="Upload via hardware encoder, mobile rig, or NDI. Clips land in a dated, project-scoped bucket with checksum verification — the same structure your editor and colourist expect."
              />
              <FeatureCard
                icon={ShieldCheck}
                title="Rights and licensing built in, not bolted on"
                body="Attach chain-of-title docs, revenue-share agreements, and territory splits to every master. When a buyer screens your film, the platform already knows who gets paid."
              />
              <FeatureCard
                icon={Globe}
                title="India-resident storage and data sovereignty"
                body="Masters live in Indian Object Storage (OCI) by default. No cross-border transfer surprises, no GDPR ambiguity for Indian productions."
              />
              <FeatureCard
                icon={IndianRupee}
                title="Pricing in INR with GST invoicing"
                body="No FX surprises. Plans are billed in rupees, with GST-compliant invoices from an Indian entity. Free Creator Basic tier; 1 TB add-ons at the live plan rate."
              />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">
              Head-to-head comparison table
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 pr-4 font-display text-foreground">Capability</th>
                    <th className="text-left py-3 pr-4 font-display text-accent">StreamVista</th>
                    <th className="text-left py-3 font-display text-muted-foreground">Frame.io</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <CompareRow
                    feature="Camera to Cloud ingest"
                    sv="Hardware, mobile, NDI, software encoder support with PAR URL ingest"
                    fi="Upload + camera-to-cloud via Frame.io C2C (Teradek / Atomos)"
                    svWin
                  />
                  <CompareRow
                    feature="Review & approval"
                    sv="Time-coded screening room with watermarking and geo-locking"
                    fi="Industry-leading commenting, drawing, and version compare"
                    fiWin
                  />
                  <CompareRow
                    feature="Rights & contract management"
                    sv="Chain-of-title, revenue splits, and licensing terms per master"
                    fi="Not available"
                    svWin
                  />
                  <CompareRow
                    feature="Data residency"
                    sv="India (OCI) by default; region-locked buckets"
                    fi="US / EU cloud; no India-specific residency guarantee"
                    svWin
                  />
                  <CompareRow
                    feature="Pricing / billing currency"
                    sv="INR + GST invoicing"
                    fi="USD pricing; FX + tax exposure for Indian users"
                    svWin
                  />
                  <CompareRow
                    feature="Archive / cold storage"
                    sv="Auto-archive inactive raw masters to Archive Vault (30-day rule)"
                    fi="Manual download / local backup only"
                    svWin
                  />
                  <CompareRow
                    feature="Adobe integration"
                    sv="Resolve / Premiere compatible via standard folders"
                    fi="Native Premiere, After Effects, and Creative Cloud integration"
                    fiWin
                  />
                  <CompareRow
                    feature="Monetisation / distribution"
                    sv="Built-in buyer screening, deal terms, and revenue tracking"
                    fi="Not available"
                    svWin
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">
              Who should stay on Frame.io
            </h2>
            <p>
              Frame.io is still the right choice if you are a post house or commercial editor in a
              US/EU workflow that lives inside Adobe Creative Cloud. The commenting precision,
              colour accuracy, and native Premiere panel are best-in-class. If your pipeline ends
              at "client approved," Frame.io wins.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">
              Who should switch to StreamVista
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong className="text-foreground">Indian productions</strong> that need data sovereignty, GST invoicing, and local support.
              </li>
              <li>
                <strong className="text-foreground">Cinema operators</strong> who ingest rushes on Monday and license the film to a regional OTT on Friday.
              </li>
              <li>
                <strong className="text-foreground">Rights-heavy content owners</strong> who need chain-of-title verification attached to every master, not just a filename.
              </li>
              <li>
                <strong className="text-foreground">Cost-conscious creators</strong> who want a free tier with real archive automation rather than paying for idle hot storage.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground font-bold mb-3">
              The "Made in India" difference
            </h2>
            <p>
              StreamVista is designed for the Indian film economy: multi-language crews, regional
              distributor networks, and a regulatory environment that increasingly demands local
              data residency. Every feature — from C2C ingest to the archive sweep to the
              revenue-share ledger — is built around the idea that a film is not finished when
              it is edited; it is finished when the deal is signed and the money is split.
            </p>
            <p className="mt-2">
              Frame.io is a review tool. StreamVista is a <strong className="text-foreground">commercial pipeline</strong>.
            </p>
          </section>

          <div className="glass-strong rounded-2xl p-6 border border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-10">
            <div>
              <h3 className="font-display text-lg text-foreground font-bold mb-1">
                Ready to move from review to revenue?
              </h3>
              <p className="text-sm">
                Start free on Creator Basic and wire up your first Camera to Cloud ingest today.
              </p>
            </div>
            <Link
              to="/pricing"
              className="h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary inline-flex items-center justify-center gap-2 shrink-0"
            >
              See Plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </article>

      <Footer />
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/40">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-display text-lg text-foreground font-bold">{title}</h3>
      </div>
      <p className="text-sm">{body}</p>
    </div>
  );
}

function CompareRow({
  feature,
  sv,
  fi,
  svWin,
  fiWin,
}: {
  feature: string;
  sv: string;
  fi: string;
  svWin?: boolean;
  fiWin?: boolean;
}) {
  return (
    <tr>
      <td className="py-3 pr-4 font-medium text-foreground align-top">{feature}</td>
      <td className="py-3 pr-4 align-top">
        <div className="flex items-start gap-2">
          {svWin ? <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />}
          <span className={svWin ? "text-foreground" : ""}>{sv}</span>
        </div>
      </td>
      <td className="py-3 align-top">
        <div className="flex items-start gap-2">
          {fiWin ? <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />}
          <span className={fiWin ? "text-foreground" : ""}>{fi}</span>
        </div>
      </td>
    </tr>
  );
}
