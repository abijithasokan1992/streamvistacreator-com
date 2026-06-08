/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your StreamVista verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandMark}>STREAMVISTA <span style={brandDot}>·</span> CLOUD X</Text>
        </Section>

        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={lead}>
          Enter the one-time code below in your StreamVista workspace to finish this secure action.
        </Text>

        <Section style={codeWrap}>
          <Text style={codeStyle}>{token}</Text>
        </Section>

        <Hr style={divider} />
        <Text style={footer}>
          This code expires shortly. If you didn't request it, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeWrap = {
  background: 'linear-gradient(135deg,#f4f6ff 0%,#f7f1ff 100%)',
  border: '1px solid #e6e9f7',
  borderRadius: '14px',
  padding: '20px 24px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '30px',
  fontWeight: 700 as const,
  color: '#08091a',
  letterSpacing: '0.32em',
  margin: 0,
}
const divider = { borderColor: '#eceef3', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#8a8f9c', margin: 0, lineHeight: '1.6' }
