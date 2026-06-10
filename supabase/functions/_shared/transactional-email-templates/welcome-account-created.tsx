import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  displayName?: string
  dashboardUrl?: string
  signedUpAt?: string
  signupMethod?: string
}

const Email = ({
  displayName = 'Creator',
  dashboardUrl = 'https://streamvistacreator.com/vault',
  signedUpAt,
  signupMethod = 'email',
}: Props) => {
  const when = signedUpAt
    ? new Date(signedUpAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to StreamVista Cloud X, {displayName}.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STREAMVISTA · CLOUD X</Text>
          </Section>
          <Heading style={h1}>Welcome aboard, {displayName}.</Heading>
          <Text style={p}>
            Your StreamVista Cloud X workspace is live. You can start ingesting footage,
            sharing review links, and shipping cuts straight from your browser.
          </Text>
          <Section style={ctaWrap}>
            <Button href={dashboardUrl} style={button}>Open my workspace</Button>
          </Section>
          <Section style={metaBox}>
            <Text style={metaItem}><strong>Signed up via:</strong> {signupMethod}</Text>
            {when && <Text style={metaItem}><strong>When:</strong> {when}</Text>}
            <Text style={metaItem}>
              <strong>Tip:</strong> Drop a file into Camera-to-Cloud to feel the speed first.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={fineprint}>
            Didn't create this account? Reply to this email so our team can lock it down.
          </Text>
          <Text style={fineprint}>
            <Link href={dashboardUrl} style={link}>{dashboardUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => `Welcome to StreamVista Cloud X${d?.displayName ? `, ${d.displayName}` : ''}.`,
  displayName: 'Welcome — account created',
  previewData: {
    displayName: 'Jane',
    dashboardUrl: 'https://streamvistacreator.com/vault',
    signedUpAt: new Date().toISOString(),
    signupMethod: 'Google',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '28px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '24px', lineHeight: '1.25', margin: '0 0 16px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const ctaWrap = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
  color: '#ffffff', padding: '14px 28px', borderRadius: '12px',
  fontWeight: 700, fontSize: '14px', letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, textDecoration: 'none', display: 'inline-block',
}
const metaBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', margin: '16px 0' }
const metaItem = { fontSize: '13px', margin: '4px 0', color: '#475569' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
const link = { color: '#0891b2', wordBreak: 'break-all' as const }
