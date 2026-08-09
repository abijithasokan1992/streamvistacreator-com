/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from './brand-logos.tsx'

interface MagicLinkEmailProps {
  siteName: string
  token: string
}

// Minimal, low-latency template — plain HTML, no images, no gradients.
// Optimised for inbox placement speed and instant render in Gmail / Outlook.
export const MagicLinkEmail = ({ token }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your StreamVista login code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>STREAMVISTA</Text>
        <Heading style={h1}>Your login code</Heading>
        <Text style={lead}>
          Enter this six-digit code in StreamVista to sign in.
        </Text>
        <Text style={code}>{token}</Text>
        <Text style={footer}>
          Didn't request this? You can safely ignore this email.
        </Text>
        <BrandLogos />
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px 12px' }
const container = { maxWidth: '480px', margin: '0 auto', padding: '8px' }
const brand = { fontSize: '12px', letterSpacing: '0.24em', color: '#08091a', fontWeight: 700 as const, margin: '0 0 16px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#08091a', margin: '0 0 10px' }
const lead = { fontSize: '14px', color: '#4a4e5c', lineHeight: '1.5', margin: '0 0 20px' }
const code = { fontSize: '32px', letterSpacing: '0.18em', color: '#08091a', fontWeight: 700 as const, margin: '0 0 20px' }
const footer = { fontSize: '12px', color: '#8a8f9c', margin: '12px 0 0' }
