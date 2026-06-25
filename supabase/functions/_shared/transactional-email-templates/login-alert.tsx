import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  displayName?: string
  loggedInAt?: string
  loginMethod?: string
  ipAddress?: string
  userAgent?: string
  resetUrl?: string
}

const Email = ({
  displayName = 'there',
  loggedInAt,
  loginMethod = 'email',
  ipAddress,
  userAgent,
  resetUrl = 'https://streamvistacreator.com/auth',
}: Props) => {
  const when = loggedInAt
    ? new Date(loggedInAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString()
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New sign-in to your StreamVista account.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STREAMVISTA · SECURITY</Text>
          </Section>
          <Heading style={h1}>Hi {displayName}, you just signed in.</Heading>
          <Text style={p}>
            We noticed a new sign-in to your StreamVista Cloud X account. If this was you,
            you can ignore this email — we just wanted to keep you in the loop.
          </Text>
          <Section style={metaBox}>
            <Text style={metaItem}><strong>When:</strong> {when}</Text>
            <Text style={metaItem}><strong>Method:</strong> {loginMethod}</Text>
            {ipAddress && <Text style={metaItem}><strong>IP address:</strong> {ipAddress}</Text>}
            {userAgent && <Text style={metaItem}><strong>Device:</strong> {userAgent}</Text>}
          </Section>
          <Text style={p}>
            <strong>Didn't sign in?</strong> Secure your account by resetting your password.
          </Text>
          <Section style={ctaWrap}>
            <Button href={resetUrl} style={button}>Secure my account</Button>
          </Section>
          <Hr style={hr} />
          <Text style={fineprint}>
            Trouble with the button?{' '}
            <Link href={resetUrl} style={link}>Open the secure link</Link>.
          </Text>
                <BrandLogos />
      </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'New sign-in to your StreamVista account',
  displayName: 'Login alert',
  previewData: {
    displayName: 'Jane',
    loggedInAt: new Date().toISOString(),
    loginMethod: 'Google',
    ipAddress: '203.0.113.42',
    userAgent: 'Chrome on macOS',
    resetUrl: 'https://streamvistacreator.com/auth',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '28px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '22px', lineHeight: '1.3', margin: '0 0 16px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const ctaWrap = { textAlign: 'center' as const, margin: '20px 0' }
const button = {
  background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
  color: '#ffffff', padding: '12px 24px', borderRadius: '12px',
  fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, textDecoration: 'none', display: 'inline-block',
}
const metaBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', margin: '16px 0' }
const metaItem = { fontSize: '13px', margin: '4px 0', color: '#475569' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
const link = { color: '#0891b2' }
