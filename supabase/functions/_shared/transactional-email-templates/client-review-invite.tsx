import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  studioName?: string
  filename?: string
  shareUrl?: string
  recipientName?: string
  expiresAt?: string | null
  hasPassword?: boolean
  viewOnly?: boolean
}

const Email = ({
  studioName = 'Your studio',
  filename = 'Your review',
  shareUrl = 'https://streamvista.in',
  recipientName,
  expiresAt,
  hasPassword,
  viewOnly,
}: Props) => {
  const greet = recipientName ? `Hi ${recipientName},` : 'Hi,'
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short',
      })
    : null

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{studioName} sent you a review link for {filename}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STREAMVISTA · CLIENT REVIEW</Text>
          </Section>

          <Heading style={h1}>A new cut is ready for your review.</Heading>
          <Text style={p}>{greet}</Text>
          <Text style={p}>
            <strong style={{ color: '#0f172a' }}>{studioName}</strong> has shared a private
            review link with you for <strong style={{ color: '#0f172a' }}>{filename}</strong>.
            Open it in the StreamVista review player to watch, drop timecoded notes, and
            approve when you're happy.
          </Text>

          <Section style={ctaWrap}>
            <Button href={shareUrl} style={button}>Open Review</Button>
          </Section>

          <Section style={metaBox}>
            <Text style={metaItem}>
              <strong>File:</strong> {filename}
            </Text>
            {expiresLabel && (
              <Text style={metaItem}>
                <strong>Link expires:</strong> {expiresLabel}
              </Text>
            )}
            {hasPassword && (
              <Text style={metaItem}>
                <strong>Password protected:</strong> the studio will share it separately.
              </Text>
            )}
            {viewOnly && (
              <Text style={metaItem}>
                <strong>View only:</strong> downloads are disabled for this share.
              </Text>
            )}
          </Section>

          <Hr style={hr} />

          <Text style={fineprint}>
            Trouble with the button?{' '}
            <Link href={shareUrl} style={link}>Open the secure review link</Link>.
          </Text>

          <Text style={fineprint}>
            Received this by mistake? You can ignore the email — the link only works for
            you and expires automatically.
          </Text>
                <BrandLogos />
      </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d?.studioName ?? 'Your studio'} sent you a review link${d?.filename ? ` · ${d.filename}` : ''}`,
  displayName: 'Client review invite',
  previewData: {
    studioName: 'Acme Studio',
    filename: 'Episode 04 — Final Cut v3.mp4',
    shareUrl: 'https://streamvista.in/s/abc123',
    recipientName: 'Jane',
    expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    hasPassword: true,
    viewOnly: false,
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
