import { LandingLayout } from "@/components/landing/LandingLayout";

export default function Buyers() {
  return (
    <LandingLayout
      path="/buyers"
      title="For Buyers — OTT, Broadcast, Satellite, FAST & Digital | StreamVista"
      description="OTT platforms, broadcasters, satellite TV networks, FAST channels, distributors and digital streaming services can discover rights-ready films, series and documentaries on StreamVista."
      h1="For OTT, Broadcast, Satellite, FAST and Digital Buyers"
      serviceName="Buyer Discovery & Enquiry"
      ctaLabel="Request Buyer Access"
      ctaHref="/contact?topic=buyer-access"
      intro={
        <>
          <p>
            StreamVista is designed to make life easier for programming, acquisition and licensing
            teams. Buyers can review rights-ready catalogues from creators, filmmakers, producers,
            studios and rights holders in one professional environment, instead of chasing pitches
            across email and messaging apps.
          </p>
          <p>
            Buyer access is verified and scoped. The platform is not open to unauthenticated public
            streaming — it is a private connectivity layer between content owners and licensing
            teams.
          </p>
        </>
      }
      sections={[
        {
          heading: "Buyer types StreamVista serves",
          body: (
            <ul className="list-disc pl-6 space-y-2">
              <li>OTT platforms and digital streaming services with defined acquisition mandates.</li>
              <li>Broadcasters and satellite television networks acquiring feature films and series.</li>
              <li>FAST channel operators building linear channels around genre or region.</li>
              <li>Distributors and aggregators representing platforms in specific territories.</li>
              <li>Film rights buyers focused on specific windows or regional catalogues.</li>
            </ul>
          ),
        },
        {
          heading: "What you see as a buyer",
          body: (
            <p>
              Verified titles with clear rights information, buyer-relevant metadata and controlled
              screener access. Where a title matches your stated acquisition interest, you can start
              a professional conversation directly with the rights holder, inside the platform.
            </p>
          ),
        },
        {
          heading: "Requesting access",
          body: (
            <p>
              Buyer access is granted after a short verification step to confirm your organisation
              and remit. This protects rights holders from unqualified contact and keeps the
              catalogue focused.
            </p>
          ),
        },
      ]}
    />
  );
}
