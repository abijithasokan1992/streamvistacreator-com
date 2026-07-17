import { LandingLayout } from "@/components/landing/LandingLayout";

export default function FilmLicensingCosts() {
  return (
    <LandingLayout
      title="Film Licensing Costs & Agreements — 2026 Guide | StreamVista"
      description="How film licensing fees are structured across OTT, satellite TV, FAST and theatrical windows — with agreement types, term sheets and negotiation levers."
      path="/guides/film-licensing-costs-and-agreements"
      h1="Film Licensing Costs & Agreements — A 2026 Guide for Rights Holders"
      serviceType="Article"
      serviceName="Film Licensing Costs & Agreements Guide"
      crumbs={[{ name: "Guides", path: "/guides/film-licensing-costs-and-agreements" }]}
      intro={
        <>
          <p>
            Film licensing fees are not a single number. They are the output of window, territory,
            language, exclusivity, duration and platform tier — negotiated between rights holders and
            OTT platforms, broadcasters, satellite TV networks, FAST channels and digital
            distributors. This guide breaks down how deals are actually priced in 2026, the
            agreement types you will see on the table, and the levers that move the number.
          </p>
          <p>
            It is written for producers, studios, sales agents and independent rights holders
            preparing catalogues for StreamVista and comparable global film content networks.
          </p>
        </>
      }
      sections={[
        {
          heading: "How film licensing fees are structured",
          body: (
            <>
              <p>
                A licensing fee is a function of six independent variables. Change any one and the
                number changes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Window</strong> — theatrical, pay TV, SVOD, AVOD/FAST, TVOD, satellite.</li>
                <li><strong>Territory</strong> — single country, region (South Asia, MENA, LATAM), worldwide.</li>
                <li><strong>Language</strong> — original, dubbed, subtitled variants each priced separately.</li>
                <li><strong>Exclusivity</strong> — exclusive, non-exclusive, first-window, holdback.</li>
                <li><strong>Term</strong> — 12 / 24 / 36 / 60 months, with or without auto-renewal.</li>
                <li><strong>Platform tier</strong> — global SVOD vs regional FAST vs niche AVOD.</li>
              </ul>
              <p>
                Two identical films can therefore command very different fees depending on how the
                rights are sliced. A worldwide-all-rights-in-perpetuity ask is almost always
                declined; a 24-month South Asia SVOD exclusive is a normal ask.
              </p>
            </>
          ),
        },
        {
          heading: "Common film licensing agreement types",
          body: (
            <>
              <p>
                Most film deals in 2026 fall into one of the following contract shapes. Each has a
                different risk profile for the rights holder:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Minimum Guarantee (MG) + Revenue Share</strong> — up-front fixed fee
                  recouped against downstream revenue. Common for SVOD acquisitions.
                </li>
                <li>
                  <strong>Flat Fee License</strong> — a single fixed amount for a defined window,
                  territory and term. No back-end.
                </li>
                <li>
                  <strong>Revenue Share Only</strong> — no MG, percentage of net revenue. Typical
                  for AVOD and FAST channels.
                </li>
                <li>
                  <strong>Cost-Per-View / CPM</strong> — used by some FAST and AVOD platforms;
                  priced against verified impressions.
                </li>
                <li>
                  <strong>Output Deal</strong> — bulk multi-title deal with a slate commitment,
                  usually studio-to-platform.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "What actually appears in a term sheet",
          body: (
            <>
              <p>
                A licensing term sheet — the document that precedes the long-form agreement —
                should always specify:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Licensed title(s) with running time and delivery format.</li>
                <li>Rights granted (window + territory + language + exclusivity).</li>
                <li>Term and start date (often tied to delivery + technical acceptance).</li>
                <li>License fee, payment schedule and reporting cadence.</li>
                <li>Delivery specification (video, audio, subtitles, metadata, artwork).</li>
                <li>Chain of title and E&O insurance requirements.</li>
                <li>Marketing and promotional rights, credit obligations.</li>
                <li>Anti-piracy, watermarking and DRM obligations.</li>
              </ul>
              <p>
                Missing any of these is the most common cause of a deal stalling at legal review.
              </p>
            </>
          ),
        },
        {
          heading: "Negotiation levers that move the fee",
          body: (
            <>
              <p>
                Before discounting the headline fee, rights holders should test these levers first:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Shorten the term — a 12-month exclusive is worth more per month than 36.</li>
                <li>Split territories — India-only + MENA-only can beat a worldwide flat.</li>
                <li>Carve out FAST or AVOD windows — resell them separately.</li>
                <li>Hold back theatrical or airline rights when unused.</li>
                <li>Package a slate — bundle a hit with a mid-tier title for higher blended MG.</li>
                <li>Bring verified performance data (festival, theatrical, prior OTT numbers).</li>
              </ul>
            </>
          ),
        },
        {
          heading: "How StreamVista supports licensing workflow",
          body: (
            <>
              <p>
                StreamVista is a workflow platform — not a broker and not a guarantor of any deal.
                Rights holders use it to present rights-ready catalogues, share secure screeners,
                exchange term sheets and coordinate delivery with OTT platforms, broadcasters,
                satellite TV, FAST channels and digital streaming buyers.
              </p>
              <p>
                Every deal, fee and clause is negotiated and executed between the rights holder and
                the buyer. StreamVista does not set, endorse or guarantee licensing fees, revenue,
                buyer response or release outcomes.
              </p>
            </>
          ),
        },
      ]}
      ctaLabel="List a Title for Licensing"
      ctaHref="/auth?intent=signup"
    />
  );
}
