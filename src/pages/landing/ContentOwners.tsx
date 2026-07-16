import { LandingLayout } from "@/components/landing/LandingLayout";

export default function ContentOwners() {
  return (
    <LandingLayout
      path="/content-owners"
      title="For Content Owners — Producers, Studios & Rights Holders | StreamVista"
      description="A workflow platform for creators, filmmakers, producers, studios and rights holders to prepare rights-ready catalogues and connect with OTT platforms, broadcasters and buyers worldwide."
      h1="For Creators, Filmmakers, Producers, Studios and Rights Holders"
      serviceName="Content Owner Workspace"
      intro={
        <>
          <p>
            If you own or represent film, series or screen content, StreamVista is a place to work.
            You bring the title and the rights; the platform helps you present them professionally
            and connect with verified OTT platforms, broadcasters, satellite TV networks, FAST
            channels and digital streaming buyers.
          </p>
          <p>
            The workflow is built around the way film and television actually gets licensed —
            territory by territory, window by window, buyer by buyer.
          </p>
        </>
      }
      sections={[
        {
          heading: "Independent producers and filmmakers",
          body: (
            <p>
              Independent film sales often lose momentum because rights information, screeners and
              buyer conversations sit in disconnected inboxes. StreamVista consolidates them into a
              single professional catalogue so a first-time producer can present a title with the
              same discipline as an established studio.
            </p>
          ),
        },
        {
          heading: "Studios and multi-title rights holders",
          body: (
            <p>
              For studios and rights holders with multiple titles, the platform supports catalogue
              management at scale: consistent metadata, coordinated rights declarations, and a shared
              workspace for the sales, licensing and legal teams involved.
            </p>
          ),
        },
        {
          heading: "Regional cinema, including Malayalam and South Indian content",
          body: (
            <p>
              Regional Indian cinema — Malayalam, Tamil, Telugu, Kannada and beyond — has strong,
              growing demand from OTT platforms, satellite TV and FAST channels. StreamVista is
              particularly attentive to regional content workflows and helps regional producers reach
              buyers who specifically license this content.
            </p>
          ),
        },
        {
          heading: "What you keep control of",
          body: (
            <p>
              You retain full ownership of your title, your rights and your buyer relationships. The
              platform does not take an option on your film, does not exclusively bind you, and does
              not license your content on your behalf.
            </p>
          ),
        },
      ]}
    />
  );
}
