import { LandingLayout } from "@/components/landing/LandingLayout";

export default function FilmRights() {
  return (
    <LandingLayout
      path="/film-rights"
      title="Film Rights — Territory, Window & Platform Licensing | StreamVista"
      description="Manage and present film rights across territory, language, exclusivity and window — OTT, satellite TV, FAST, digital and broadcast. StreamVista is a workflow platform for rights holders and buyers."
      h1="Film Rights: Territory, Window and Platform"
      serviceName="Rights Presentation & Discovery"
      intro={
        <>
          <p>
            Film rights are rarely a single yes-or-no. A title carries different rights by
            territory, language, exclusivity and window — theatrical, OTT, satellite TV, FAST
            channel, digital streaming, physical media and more. StreamVista helps rights holders
            present that structure clearly, and helps buyers evaluate quickly.
          </p>
        </>
      }
      sections={[
        {
          heading: "A structured rights matrix",
          body: (
            <p>
              Every title on StreamVista supports a structured rights declaration: which territories
              are available, in which languages, for which windows, and whether the offer is
              exclusive or non-exclusive. This is the same information a buyer's legal team needs
              before commercials can begin.
            </p>
          ),
        },
        {
          heading: "Common rights configurations",
          body: (
            <ul className="list-disc pl-6 space-y-2">
              <li>Global non-exclusive OTT rights, excluding named territories.</li>
              <li>Regional exclusive satellite TV film rights for a defined window.</li>
              <li>Digital streaming rights bundled with FAST channel content licensing.</li>
              <li>Language-scoped rights for regional Indian cinema across South Asia and diaspora markets.</li>
            </ul>
          ),
        },
        {
          heading: "Why this matters for a deal",
          body: (
            <p>
              Buyers reject or delay titles when rights are unclear. A clean rights matrix is often
              the difference between a serious conversation and a dropped enquiry. StreamVista's
              workflow is designed around that reality.
            </p>
          ),
        },
      ]}
    />
  );
}
