import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  userEmail?: string
  userId?: string
  severity?: 'info' | 'warning' | 'error'
  title?: string
  message?: string
  context?: string
  page?: string
  occurredAt?: string
}

const Email = ({
  userEmail = 'unknown@user',
  userId = '—',
  severity = 'info',
  title = 'System message reported',
  message = '',
  context = '',
  page = '',
  occurredAt,
}: Props) => {
  const sevColor = severity === 'error' ? '#dc2626' : severity === 'warning' ? '#d97706' : '#0891b2'
  const when = occurredAt
    ? new Date(occurredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString()
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{userEmail} reported a system message: {title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...brandBar, backgroundColor: '#0f172a' }}>
            <Text style={brandText}>STREAMVISTA · USER REPORT</Text>
          </Section>
          <Heading style={h1}>A user reported a system message.</Heading>
          <Section style={{ ...sevPill, borderColor: sevColor, color: sevColor }}>
            <Text style={{ margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {severity}
            </Text>
          </Section>
          <Section style={metaBox}>
            <Text style={metaItem}><strong>Title:</strong> {title}</Text>
            <Text style={metaItem}><strong>Message:</strong> {message || '—'}</Text>
            {context && <Text style={metaItem}><strong>Context:</strong> {context}</Text>}
            {page && <Text style={metaItem}><strong>Page:</strong> {page}</Text>}
            <Text style={metaItem}><strong>User:</strong> {userEmail} ({userId})</Text>
            <Text style={metaItem}><strong>When:</strong> {when}</Text>
          </Section>
          <Hr style={hr} />
          <Text style={fineprint}>
            A matching support ticket was also created in the admin Support Inbox.
          </Text>
                <BrandLogos />
      </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => `[${(d?.severity ?? 'info').toUpperCase()}] User report: ${d?.title ?? 'System message'}`,
  displayName: 'System message report',
  previewData: {
    userEmail: 'jane@example.com',
    userId: '00000000-0000-0000-0000-000000000000',
    severity: 'error',
    title: 'Upload failed',
    message: 'The upload could not be completed because the source file was unreadable.',
    context: 'fileId=abc123, bucket=vault',
    page: '/vault',
    occurredAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', borderRadius: '12px', marginBottom: '24px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '22px', lineHeight: '1.3', margin: '0 0 14px', fontWeight: 800 }
const sevPill = { display: 'inline-block', border: '1px solid', borderRadius: '999px', padding: '4px 10px', margin: '0 0 16px' }
const metaBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', margin: '8px 0' }
const metaItem = { fontSize: '13px', margin: '4px 0', color: '#475569' }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
