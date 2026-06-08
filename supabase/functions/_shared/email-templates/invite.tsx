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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're invited to a StreamVista workspace</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandMark}>STREAMVISTA <span style={brandDot}>·</span> CLOUD X</Text>
        </Section>

        <Heading style={h1}>You're invited</Heading>
        <Text style={lead}>
          A creator on <Link href={siteUrl} style={inlineLink}>StreamVista</Link> has invited you to collaborate inside their secure cloud workspace. Accept to set your password and jump in.
        </Text>

        <Section style={ctaWrap}>
          <Button style={button} href={confirmationUrl}>Accept invitation</Button>
        </Section>

        <Text style={fineprint}>
          Or paste this link into your browser:<br />
          <Link href={confirmationUrl} style={rawLink}>{confirmationUrl}</Link>
        </Text>

        <Hr style={divider} />
        <Text style={footer}>
          Not expecting an invite? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const brandMark = { fontSize: '11px', letterSpacing: '0.32em', color: '#08091a', fontWeight: 700 as const, margin: 0 }
const brandDot = { color: '#F5C73A' }
const h1 = { fontSize: '26px', fontWeight: 700 as const, color: '#08091a', margin: '0 0 14px', letterSpacing: '-0.01em' }
const lead = { fontSize: '15px', color: '#4a4e5c', lineHeight: '1.6', margin: '0 0 28px' }
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
}
const fineprint = { fontSize: '12px', color: '#8a8f9c', lineHeight: '1.5', margin: '0 0 24px', wordBreak: 'break-all' as const }
const rawLink = { color: '#3D7BFD', textDecoration: 'underline' }
const divider = { borderColor: '#eceef3', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#8a8f9c', margin: 0, lineHeight: '1.6' }
