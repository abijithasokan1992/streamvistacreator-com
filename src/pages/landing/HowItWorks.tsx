import { LandingLayout } from "@/components/landing/LandingLayout";

export default function HowItWorks() {
  return (
    <LandingLayout
      path="/how-it-works"
      title="How StreamVista Works — Connecting Content Owners and Buyers"
      description="A step-by-step overview of how creators, filmmakers, producers, studios and rights holders present titles on StreamVista and connect with OTT platforms, broadcasters and streaming buyers."
      h1="How StreamVista Works"
      serviceName="Platform Workflow"
      intro={
        <p>
          StreamVista is a connectivity and workflow platform. It gives content owners a
          structured way to present films, series and documentaries, and gives verified buyers a
          structured way to review and respond. Here is how the workflow runs end to end.
        </p>
      }
      sections={[
        {
          heading: "1. Create your workspace",
          body: (
            <p>
              A creator, producer, studio or rights holder creates a free workspace. The account is
              scoped to your organisation; roles inside the workspace control who can edit titles,
              manage rights and speak to buyers.
            </p>
          ),
        },
        {
          heading: "2. Prepare rights-ready titles",
          body: (
            <p>
              Add each title with structured metadata, a rights declaration by territory and window,
              and controlled screener access. The workflow is designed so that a title is only
              published to buyers once its rights information is coherent.
            </p>
          ),
        },
        {
          heading: "3. Connect with verified buyers",
          body: (
            <p>
              Verified OTT platforms, broadcasters, satellite TV networks, FAST channel operators
              and digital streaming buyers can discover titles that match their stated acquisition
              interest and start a professional conversation.
            </p>
          ),
        },
        {
          heading: "4. Manage delivery workflows",
          body: (
            <p>
              When a deal moves forward, StreamVista supports the practical delivery workflow —
              deliverables tracking, technical QC references and secure workflow storage — so the
              handover to the buyer is professional and auditable.
            </p>
          ),
        },
        {
          heading: "What the platform does not do",
          body: (
            <p>
              StreamVista does not sign contracts on your behalf, does not guarantee buyer response,
              licensing, release or revenue, and does not represent itself as an agent or
              distributor. Content owners and buyers remain the principals in every deal.
            </p>
          ),
        },
      ]}
    />
  );
}
