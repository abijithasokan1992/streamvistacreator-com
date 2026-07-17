import { Link } from "react-router-dom";
import { Shield, Mail, FileText } from "lucide-react";
import { DMCAForm } from "@/components/streamvista/DMCAForm";

export default function DMCA() {
  return (
    <main className="min-h-dvh">
      <div className="container max-w-3xl py-20">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground">← Back to StreamVista Creator</Link>

        <header className="mt-8 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-[0.2em] text-accent mb-5">
            <Shield className="w-3.5 h-3.5" /> Legal · Policy
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">DMCA &amp; Copyright Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
        </header>

        <article className="glass-strong rounded-3xl p-8 md:p-10 space-y-8 text-sm md:text-base leading-relaxed">
          <Section icon={FileText} title="1. Our Commitment">
            StreamVista Creator (operated by Crayons) respects the intellectual property rights of creators, studios, and rights-holders. We respond promptly to clear notices of alleged copyright infringement in compliance with the Digital Millennium Copyright Act (DMCA) and the Information Technology Act, 2000 (India), along with the Intermediary Guidelines, 2021.
          </Section>

          <Section icon={FileText} title="2. Filing a Takedown Notice">
            <p>To report material that you believe infringes your copyright, send a written notice to our Designated Agent (below) containing:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>A physical or electronic signature of the rights-holder or authorized agent.</li>
              <li>Identification of the copyrighted work claimed to be infringed.</li>
              <li>The exact URL or asset reference of the allegedly infringing material on StreamVista Creator.</li>
              <li>Your contact details — full name, address, telephone, and email.</li>
              <li>A statement of good-faith belief that the disputed use is not authorized by the rights-holder, its agent, or the law.</li>
              <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act on behalf of the rights-holder.</li>
            </ul>
          </Section>

          <Section icon={FileText} title="3. Counter-Notice">
            If you believe your content was removed by mistake or misidentification, you may submit a counter-notice with: your signature, identification of the material removed and its original location, a statement under penalty of perjury that the removal was in error, and your consent to the jurisdiction of competent courts in Mumbai, India.
          </Section>

          <Section icon={FileText} title="4. Repeat Infringer Policy">
            Accounts that receive multiple substantiated infringement notices will be suspended and may be terminated. Stored assets may be permanently deleted in accordance with our retention policy.
          </Section>

          <div className="rounded-xl border border-border/50 bg-background/40 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Notice to uploaders</p>
            <p>Accounts with multiple substantiated notices may be suspended or terminated, and stored assets permanently deleted per our retention policy.</p>
          </div>

          <Section icon={FileText} title="5. False Claims">
            Knowingly submitting a misrepresentation under this policy may subject you to liability for damages, including legal costs, under applicable copyright law.
          </Section>

          <Section icon={Mail} title="6. Designated Agent">
            <div className="space-y-1">
              <div><span className="text-muted-foreground">Attention:</span> DMCA Agent, Crayons Creator Cloud</div>
              <div><span className="text-muted-foreground">Email:</span> <a className="text-accent hover:underline" href="mailto:dmca@streamvista.cloud">dmca@streamvista.cloud</a></div>
              <div><span className="text-muted-foreground">Postal:</span> Mumbai, Maharashtra, India</div>
              <p className="text-xs text-muted-foreground mt-3">We aim to acknowledge valid notices within 48 business hours.</p>
            </div>
          </Section>

          <Section icon={Mail} title="7. Grievance Officer" id="grievance">
            <div className="space-y-1">
              <div><span className="text-muted-foreground">Attention:</span> Grievance Officer, StreamVista OPC Pvt Ltd</div>
              <div><span className="text-muted-foreground">Email:</span> <a className="text-accent hover:underline" href="mailto:dmca@streamvista.cloud">dmca@streamvista.cloud</a></div>
              <div><span className="text-muted-foreground">Postal:</span> Ernakulam, Kerala, India</div>
              <p className="text-xs text-muted-foreground mt-3">Designated under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</p>
            </div>
          </Section>
        </article>

        <div id="submit-notice" className="mt-12 scroll-mt-24">
          <DMCAForm />
        </div>
      </div>
    </main>
  );
}

const Section = ({ icon: Icon, title, children, id }: { icon: any; title: string; children: React.ReactNode; id?: string }) => (
  <section id={id}>
    <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-accent" /> {title}
    </h2>
    <div className="text-muted-foreground space-y-2">{children}</div>
  </section>
);
