import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  titleName?: string
  creatorEmail?: string
  creatorId?: string
  submittedAt?: string
  inboxUrl?: string
}

const Email = ({
  titleName = 'Untitled',
  creatorEmail = 'unknown@creator',
  creatorId = '—',
  submittedAt,
  inboxUrl = 'https://streamvistacreator.com/dashboard/content-owner?section=admin',
}: Props) => {
  const when = submittedAt
    ? new Date(submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString()
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New title submitted for review: {titleName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STREAMVISTA · ACTION INBOX</Text>
          </Section>
          <Heading style={h1}>New title awaiting review</Heading>
          <Text style={p}>
            A creator has submitted a new title and it is now pending in the Action Inbox.
          </Text>
          <Section style={metaBox}>
            <Text style={metaItem}><strong>Title:</strong> {titleName}</Text>
            <Text style={metaItem}><strong>Creator:</strong> {creatorEmail}</Text>
            <Text style={metaItem}><strong>Creator ID:</strong> {creatorId}</Text>
            <Text style={metaItem}><strong>Submitted:</strong> {when}</Text>
          </Section>
          <Section style={ctaWrap}>
            <a href={inboxUrl} style={button}>Open Action Inbox</a>
          </Section>
          <Hr style={hr} />
          <Text style={fineprint}>
            You are receiving this because you are a platform administrator on StreamVista Creator.
            Log in to the admin dashboard to review, approve, or request changes.
          </Text>
                <BrandLogos />
      </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => `[Action Required] New title submitted: ${d?.titleName ?? 'Untitled'}`,
  displayName: 'Title submission — admin alert',
  previewData: {
    titleName: 'The Last Signal',
    creatorEmail: 'creator@example.com',
    creatorId: '00000000-0000-0000-0000-000000000000',
    submittedAt: new Date().toISOString(),
    inboxUrl: 'https://streamvistacreator.com/dashboard/content-owner?section=admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '24px' }
const brandText = { color: '#f59e0b', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '22px', lineHeight: '1.3', margin: '0 0 12px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const metaBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', margin: '8px 0 20px' }
const metaItem = { fontSize: '13px', margin: '4px 0', color: '#475569' }
const ctaWrap = { textAlign: 'center' as const, margin: '24px 0 8px' }
const button = {
  background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
  color: '#ffffff', padding: '12px 24px', borderRadius: '12px',
  fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
