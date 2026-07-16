import { LandingLayout } from "@/components/landing/LandingLayout";

export default function SellYourFilm() {
  return (
    <LandingLayout
      path="/sell-your-film"
      title="Sell Your Film — Connect With OTT, Broadcasters & Buyers | StreamVista"
      description="List your feature film, series or documentary on StreamVista and connect with verified OTT platforms, broadcasters, satellite TV networks, FAST channels and digital streaming buyers worldwide."
      h1="Sell Your Film to OTT Platforms and Global Buyers"
      serviceName="Film Sales & Buyer Connectivity"
      crumbs={[{ name: "For Content Owners", path: "/content-owners" }]}
      intro={
        <>
          <p>
            StreamVista helps creators, filmmakers, producers, studios and rights holders present
            their films, series and screen content to verified OTT platforms, broadcasters,
            satellite television networks, FAST channels and digital streaming services around the
            world.
          </p>
          <p>
            Prepare a rights-ready catalogue, publish professional metadata and make your title
            discoverable to buyers looking for feature films, documentaries and episodic content
            for licensing.
          </p>
        </>
      }
      sections={[
        {
          heading: "Who this is for",
          body: (
            <>
              <p>
                Independent producers, studios, regional cinema houses, documentary makers and rights
                holders who want a structured way to connect with content buyers instead of
                one-off email pitches and unverifiable contacts.
              </p>
              <p>
                Whether you are looking to license film to streaming platforms, sell a film to an
                OTT platform, place a series on a FAST channel, or negotiate satellite TV film
                rights for a specific territory, the workflow is the same: prepare the title,
                publish it privately to verified buyers, and manage responses professionally.
              </p>
            </>
          ),
        },
        {
          heading: "What you can prepare on StreamVista",
          body: (
            <ul className="list-disc pl-6 space-y-2">
              <li>Structured title metadata: synopsis, cast, crew, runtime, language, genre and rating.</li>
              <li>Rights declarations by territory, language and window (theatrical, OTT, satellite, FAST, digital).</li>
              <li>Preview and screener material with controlled access for buyer review.</li>
              <li>Supporting delivery information: technical specs, subtitle availability and QC status.</li>
              <li>A private catalogue link you can share with buyers your team already knows.</li>
            </ul>
          ),
        },
        {
          heading: "How buyer connectivity works",
          body: (
            <p>
              Buyers on StreamVista include OTT platforms, broadcasters, distributors, aggregators and
              rights buyers. When your title matches a buyer's stated interest — for example, Malayalam
              feature films for South Asian OTT, or independent documentaries for global FAST — your
              catalogue entry becomes visible to that buyer for review and enquiry. All buyer
              conversations happen inside the platform, with a clear audit trail.
            </p>
          ),
        },
        {
          heading: "Storage is a supporting workflow, not the product",
          body: (
            <p>
              StreamVista includes secure workflow storage so producers can keep masters, proxies and
              screeners in one place while a title is being licensed. Storage is a supporting feature
              of the connectivity workflow — the platform's purpose is to help content owners reach
              buyers, not to sell storage capacity.
            </p>
          ),
        },
      ]}
    />
  );
}
