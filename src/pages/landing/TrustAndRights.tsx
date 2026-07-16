import { LandingLayout } from "@/components/landing/LandingLayout";

export default function TrustAndRights() {
  return (
    <LandingLayout
      path="/trust-and-rights"
      title="Trust & Rights — Verified Buyers and IP Protection | StreamVista"
      description="How StreamVista verifies buyers, protects content owner IP, handles screener access and enforces its rights and copyright policies across films, series and documentaries."
      h1="Trust and Rights on StreamVista"
      serviceName="Trust, IP Protection & Rights Enforcement"
      intro={
        <p>
          StreamVista exists because film and television rights holders deserve a professional,
          verifiable environment to work in. This page explains how trust, verification and rights
          protection are handled across the platform.
        </p>
      }
      sections={[
        {
          heading: "Buyer verification",
          body: (
            <p>
              Buyer accounts — OTT platforms, broadcasters, satellite TV networks, FAST channel
              operators, distributors and digital streaming services — go through a verification
              step before they can access catalogues. This keeps unqualified contact away from
              rights holders.
            </p>
          ),
        },
        {
          heading: "Content owner IP protection",
          body: (
            <p>
              Screener access is controlled per buyer and per title. Public streaming is not part of
              the platform. See our{" "}
              <a href="/ip-copyright" className="underline underline-offset-4">IP & Copyright policy</a>{" "}
              and <a href="/dmca" className="underline underline-offset-4">DMCA process</a>{" "}
              for how takedown requests and rights disputes are handled.
            </p>
          ),
        },
        {
          heading: "Data and security posture",
          body: (
            <p>
              StreamVista uses standard cloud security controls, encrypted transport for all traffic,
              and workspace-scoped access controls. Payment operations are handled through Razorpay
              in accordance with Indian regulatory requirements.
            </p>
          ),
        },
        {
          heading: "No fabricated claims",
          body: (
            <p>
              StreamVista does not publish fabricated reviews, ratings, partners, buyers, deals,
              awards or guarantees. Any partner logo or case study will only appear on the site
              with the counterparty's written confirmation.
            </p>
          ),
        },
      ]}
    />
  );
}
