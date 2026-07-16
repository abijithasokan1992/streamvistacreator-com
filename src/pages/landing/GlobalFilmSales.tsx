import { LandingLayout } from "@/components/landing/LandingLayout";

export default function GlobalFilmSales() {
  return (
    <LandingLayout
      path="/global-film-sales"
      title="Global Film Sales — Multi-Territory Licensing Workflow | StreamVista"
      description="Present films, series and documentaries to OTT platforms, broadcasters, satellite TV networks, FAST channels and digital streaming services across global territories on StreamVista."
      h1="Global Film Sales Across Territories and Platforms"
      serviceName="Global Film Sales Workflow"
      intro={
        <>
          <p>
            Film sales rarely stop at a single territory. A serious title carries opportunities in
            multiple regions and across multiple platform types — OTT, broadcast, satellite TV,
            FAST channels and digital streaming services. StreamVista is a workflow platform for
            handling that complexity without losing track of it.
          </p>
        </>
      }
      sections={[
        {
          heading: "Multi-territory catalogue",
          body: (
            <p>
              Rights holders can declare which territories are open, which are already licensed,
              and which are being actively negotiated. Buyers see the current state, so
              conversations stay accurate.
            </p>
          ),
        },
        {
          heading: "Cross-platform windows",
          body: (
            <p>
              A single title can be positioned differently across windows — OTT-first in one region,
              satellite-first in another, FAST-only for older library material. StreamVista's
              structure supports these decisions instead of forcing a single global template.
            </p>
          ),
        },
        {
          heading: "Realistic timelines",
          body: (
            <p>
              International licensing moves at the pace of buyer programming cycles. StreamVista
              supports the workflow but does not promise a specific outcome or timeline; buyer
              response and commercial terms remain the buyer's decision.
            </p>
          ),
        },
      ]}
    />
  );
}
