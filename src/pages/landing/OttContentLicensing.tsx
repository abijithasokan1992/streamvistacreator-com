import { LandingLayout } from "@/components/landing/LandingLayout";

export default function OttContentLicensing() {
  return (
    <LandingLayout
      path="/ott-content-licensing"
      title="OTT Content Licensing — Films, Series & Documentaries | StreamVista"
      description="License films, series and documentaries to OTT platforms, digital streaming services and FAST channels. StreamVista connects verified content owners with acquisition teams worldwide."
      h1="OTT Content Licensing for Films, Series and Documentaries"
      serviceName="OTT Content Licensing Connectivity"
      intro={
        <>
          <p>
            OTT platforms, digital streaming services and FAST channels acquire licensing rights to
            films, series and documentaries every day. StreamVista connects rights holders with the
            acquisition teams who buy those rights, using a structured catalogue and rights-first
            workflow.
          </p>
          <p>
            Whether the target is a global streaming service, a regional OTT operator or a niche FAST
            channel, licensing runs on the same fundamentals: verified rights, clear metadata,
            reviewable screeners and disciplined conversation.
          </p>
        </>
      }
      sections={[
        {
          heading: "Licensing scenarios StreamVista supports",
          body: (
            <ul className="list-disc pl-6 space-y-2">
              <li>License a film to a streaming platform in a specific territory and language.</li>
              <li>Package a documentary series for a FAST channel with defined episode counts.</li>
              <li>Offer non-exclusive digital streaming rights across multiple regions.</li>
              <li>Coordinate satellite TV film rights alongside OTT and digital rights.</li>
              <li>Present a regional catalogue — for example, Malayalam and other South Indian titles — to interested OTT buyers.</li>
            </ul>
          ),
        },
        {
          heading: "Why rights hygiene matters",
          body: (
            <p>
              Serious buyers only move forward on titles where rights are clean and clearly stated.
              StreamVista's title workflow asks for the same rights information a buyer's legal team
              will ask for — territories, languages, windows, exclusivity, chain of title — so the
              deal conversation can move directly to commercials.
            </p>
          ),
        },
        {
          heading: "Honest expectations",
          body: (
            <p>
              StreamVista provides the connectivity layer between rights holders and licensing
              buyers. Deal outcomes depend on the title, the market and buyer strategy, and are not
              guaranteed by the platform.
            </p>
          ),
        },
      ]}
    />
  );
}
