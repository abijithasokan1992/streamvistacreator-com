import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  displayName?: string
}

const Email = ({ displayName = 'Aruna' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your StreamVista activation is now complete.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>STREAMVISTA · ACTIVATION</Text>
        </Section>
        <Heading style={h1}>Your StreamVista activation is now complete</Heading>
        <Text style={p}>Dear {displayName},</Text>
        <Text style={p}>
          Your payment has been received successfully, and your StreamVista activation is now complete.
        </Text>
        <Text style={p}>
          More than a transaction, this marks a very special milestone for us — the first official
          payment in the StreamVista journey. Thank you for being part of this beginning, and for
          placing your trust in something being built with care, conviction, and a great deal of heart.
        </Text>
        <Text style={p}>
          Your activation is now recorded in the system, and the next steps on your StreamVista
          account can move forward from here.
        </Text>
        <Hr style={hr} />
        <Text style={signoff}>With gratitude,</Text>
        <Text style={signoffName}>Abijith Asokan</Text>
        <Text style={signoffTitle}>Founder &amp; Managing Director</Text>
        <Text style={signoffTitle}>StreamVista OPC Pvt Ltd</Text>
        <BrandLogos />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your StreamVista activation is now complete',
  displayName: 'Inaugural founder activation',
  previewData: { displayName: 'Aruna' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '28px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '22px', lineHeight: '1.3', margin: '0 0 18px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.7', margin: '0 0 14px' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const signoff = { fontSize: '14px', margin: '4px 0', color: '#334155' }
const signoffName = { fontSize: '15px', margin: '6px 0 0', color: '#0f172a', fontWeight: 700 }
const signoffTitle = { fontSize: '13px', margin: '2px 0', color: '#475569' }
