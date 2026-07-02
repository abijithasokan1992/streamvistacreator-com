/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from './brand-logos.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your StreamVista workspace</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandMark}>STREAMVISTA <span style={brandDot}>·</span> CLOUD X</Text>
        </Section>

        <Heading style={h1}>Verify your workspace</Heading>
        <Text style={lead}>
          Welcome to <strong>StreamVista</strong>. Confirm <Link href={`mailto:${recipient}`} style={inlineLink}>{recipient}</Link> to activate your Free creator workspace and start sharing files securely.
        </Text>

        <Section style={ctaWrap}>
          <Button style={button} href={confirmationUrl}>Verify &amp; Enter Workspace</Button>
        </Section>

        <Text style={fineprint}>
          Or paste this link into your browser:<br />
          <Link href={confirmationUrl} style={rawLink}>{confirmationUrl}</Link>
        </Text>

        <Hr style={divider} />
        <Text style={footer}>
          You're receiving this because someone signed up at <Link href={siteUrl} style={footerLink}>StreamVista</Link>. If that wasn't you, simply ignore this email.
        </Text>
              <BrandLogos />
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Inter, Arial, sans-serif',
  margin: 0,
  padding: '40px 12px',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 36px',
  border: '1px solid #eceef3',
  borderRadius: '20px',
  backgroundColor: '#ffffff',
}
const brandBar = { marginBottom: '28px' }
const brandMark = {
  fontSize: '11px',
  letterSpacing: '0.32em',
  color: '#08091a',
  fontWeight: 700 as const,
  margin: 0,
}
const brandDot = { color: '#F5C73A' }
const h1 = {
  fontSize: '26px',
  fontWeight: 700 as const,
  color: '#08091a',
  margin: '0 0 14px',
  letterSpacing: '-0.01em',
}
const lead = {
  fontSize: '15px',
  color: '#4a4e5c',
  lineHeight: '1.6',
  margin: '0 0 28px',
}
const inlineLink = { color: '#3D7BFD', textDecoration: 'none', fontWeight: 600 as const }
const ctaWrap = { margin: '0 0 24px' }
const button = {
  display: 'inline-block',
  backgroundImage: 'linear-gradient(135deg,#3D7BFD 0%,#8B6BFC 100%)',
  backgroundColor: '#3D7BFD',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '14px',
  padding: '14px 26px',
  textDecoration: 'none',
  letterSpacing: '0.01em',
}
const fineprint = {
  fontSize: '12px',
  color: '#8a8f9c',
  lineHeight: '1.5',
  margin: '0 0 24px',
  wordBreak: 'break-all' as const,
}
const rawLink = { color: '#3D7BFD', textDecoration: 'underline' }
const divider = { borderColor: '#eceef3', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#8a8f9c', margin: 0, lineHeight: '1.6' }
const footerLink = { color: '#08091a', textDecoration: 'none', fontWeight: 600 as const }
