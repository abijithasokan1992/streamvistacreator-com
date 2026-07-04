import { Link } from "react-router-dom";
import { LegalLayout, LegalSection } from "@/components/streamvista/LegalLayout";
import { Seo } from "@/components/Seo";
import { useLocation } from "react-router-dom";

export default function IPCopyright() {
  const { pathname } = useLocation();
  const path = pathname === "/dmca" ? "/dmca" : "/ip-copyright";
  return (
    <>
      <Seo
        title={path === "/dmca" ? "DMCA & Copyright Policy — StreamVista" : "IP & Copyright Policy — StreamVista"}
        description={path === "/dmca" ? "Report copyright infringement on StreamVista Cloud X. Submit a DMCA takedown notice to our designated agent and view our counter-notice and repeat-infringer procedures." : "StreamVista Cloud X intellectual property rights policy — how we protect creator IP, handle DMCA notices, counter-claims, and repeat infringement on our platform."}
        path={path}
        image={path === "/dmca" ? "/og/dmca.jpg" : "/og/ip-copyright.jpg"}
      />
    <LegalLayout title="IP & Copyright (DMCA) Policy" eyebrow="Legal · IP & DMCA">

      <div className="flex flex-wrap gap-3 pb-2">
        <Link to="/dmca#submit-notice" className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Report infringement</Link>
        <Link to="/dmca#grievance" className="inline-flex items-center justify-center h-10 px-5 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">Contact grievance officer</Link>
      </div>

      <LegalSection title="1. Our Commitment">
        StreamVista OPC Pvt Ltd and Crayons Pictures respect the intellectual property rights of
        creators, studios, and rights-holders. We respond promptly to clear notices of alleged
        copyright infringement in compliance with the U.S. Digital Millennium Copyright Act (DMCA),
        the Indian Copyright Act, 1957, the Information Technology Act, 2000, and the Intermediary
        Guidelines, 2021.
      </LegalSection>

      <LegalSection title="2. Filing a Takedown Notice">
        <p>
          To report content that you believe infringes your copyright on StreamVista Cloud X, send a
          written notice to our Designated Agent containing:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>A physical or electronic signature of the rights-holder or authorized agent.</li>
          <li>Identification of the copyrighted work claimed to be infringed.</li>
          <li>The exact URL or asset reference of the allegedly infringing material.</li>
          <li>Your contact details — full name, address, telephone, and email.</li>
          <li>
            A statement of good-faith belief that the disputed use is not authorized by the
            rights-holder, its agent, or the law.
          </li>
          <li>
            A statement, under penalty of perjury, that the information is accurate and you are
            authorized to act on behalf of the rights-holder.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Counter-Notice">
        If you believe your content was removed by mistake or misidentification, you may submit a
        counter-notice including your signature, identification of the material removed and its
        original location, a statement under penalty of perjury that the removal was in error, and
        your consent to the jurisdiction of competent courts in Ernakulam, Kerala, India.
      </LegalSection>

      <LegalSection title="4. Repeat Infringer Policy">
        Accounts that receive multiple substantiated infringement notices will be suspended and may
        be terminated. Stored assets may be permanently deleted in accordance with our retention
        policy.
      </LegalSection>

      <LegalSection title="5. False Claims">
        Knowingly submitting a misrepresentation under this policy may subject you to liability for
        damages, including legal costs, under applicable copyright law.
      </LegalSection>

      <LegalSection title="6. Designated Agent">
        <div className="space-y-1">
          <div>
            <span>Attention:</span> DMCA Agent, StreamVista OPC Pvt Ltd
          </div>
          <div>
            <span>Email:</span>{" "}
            <a className="text-accent hover:underline" href="mailto:support@streamvistacreator.com">
              support@streamvistacreator.com
            </a>
          </div>
          <div>
            <span>Postal:</span> Ernakulam, Kerala, India
          </div>
          <p className="text-xs mt-3">
            We aim to acknowledge valid notices within 48 business hours.
          </p>
        </div>
      </LegalSection>
    </LegalLayout>
    </>
  );
}
