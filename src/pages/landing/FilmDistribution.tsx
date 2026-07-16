import { LandingLayout } from "@/components/landing/LandingLayout";

export default function FilmDistribution() {
  return (
    <LandingLayout
      path="/film-distribution"
      title="Film Distribution Platform — OTT, Broadcast, Satellite & FAST | StreamVista"
      description="Coordinate film distribution across OTT platforms, broadcasters, satellite television, FAST channels and digital streaming services. StreamVista is a workflow platform for producers, studios and rights holders."
      h1="Film Distribution Workflow for a Multi-Platform World"
      serviceName="Film Distribution Workflow"
      intro={
        <>
          <p>
            Modern film distribution runs across OTT platforms, national and regional broadcasters,
            satellite television, FAST channels and digital streaming services. StreamVista is a
            connectivity and workflow platform that gives content owners a single, professional place
            to prepare, present and track distribution activity.
          </p>
          <p>
            The platform is designed for producers, studios and rights holders who move a title
            through multiple windows and territories, and want to keep rights, deliverables and buyer
            conversations organised end-to-end.
          </p>
        </>
      }
      sections={[
        {
          heading: "One workflow, many destinations",
          body: (
            <p>
              Content owners can prepare rights-ready catalogues that make sense to different buyer
              types — OTT programming teams, broadcast acquisition, satellite TV rights buyers, FAST
              channel operators, and digital streaming aggregators. Each destination has different
              expectations for metadata, screeners and deliverables; StreamVista helps you keep them
              consistent.
            </p>
          ),
        },
        {
          heading: "Where StreamVista fits in your distribution chain",
          body: (
            <ul className="list-disc pl-6 space-y-2">
              <li>Catalogue preparation with clean, buyer-ready metadata.</li>
              <li>Rights matrix by territory, language, exclusivity and window.</li>
              <li>Controlled screener sharing for evaluation, not public streaming.</li>
              <li>Buyer discovery: making your titles visible to verified OTT, broadcast, satellite, FAST and digital buyers.</li>
              <li>Delivery workflows aligned to standard film industry expectations.</li>
            </ul>
          ),
        },
        {
          heading: "What StreamVista does not do",
          body: (
            <p>
              StreamVista does not sign licence deals on your behalf, does not guarantee that a buyer
              will respond, and does not commit to a distribution outcome. The platform provides the
              professional connectivity and workflow — the commercial deal remains between the
              content owner and the buyer.
            </p>
          ),
        },
      ]}
    />
  );
}
