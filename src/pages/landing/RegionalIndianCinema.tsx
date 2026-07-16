import { LandingLayout } from "@/components/landing/LandingLayout";

export default function RegionalIndianCinema() {
  return (
    <LandingLayout
      path="/regional-indian-cinema"
      title="Regional Indian Cinema — Malayalam & South Indian Licensing | StreamVista"
      description="License Malayalam, Tamil, Telugu, Kannada and other regional Indian films and series to OTT platforms, satellite TV networks, FAST channels and digital streaming buyers worldwide."
      h1="Regional Indian Cinema — Malayalam and South Indian Content"
      serviceName="Regional Indian Content Licensing"
      intro={
        <>
          <p>
            Regional Indian cinema has become a major driver of OTT, satellite television and FAST
            channel programming. Malayalam, Tamil, Telugu, Kannada and other South Indian films and
            series are actively acquired by domestic OTT platforms, global streaming services and
            diaspora-facing FAST channels.
          </p>
          <p>
            StreamVista is built with regional content in mind — including language metadata,
            subtitle availability, region-scoped rights and buyer discovery paths that match how
            regional acquisitions actually work.
          </p>
        </>
      }
      sections={[
        {
          heading: "What regional producers can present",
          body: (
            <ul className="list-disc pl-6 space-y-2">
              <li>Malayalam feature films with clean chain of title and subtitle deliverables.</li>
              <li>South Indian series and documentaries with episode-level metadata.</li>
              <li>Language-scoped rights and territory-scoped rights, clearly declared.</li>
              <li>Screener access controlled per buyer.</li>
            </ul>
          ),
        },
        {
          heading: "Who this reaches",
          body: (
            <p>
              OTT platforms with strong regional programming appetite, satellite TV networks covering
              South Asia, FAST channel operators building language-specific linear channels, and
              digital streaming services targeting diaspora audiences.
            </p>
          ),
        },
      ]}
    />
  );
}
