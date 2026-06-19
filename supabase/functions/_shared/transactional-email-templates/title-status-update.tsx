import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  titleName?: string
  toStatus?: string
  toStatusLabel?: string
  fromStatus?: string | null
  note?: string | null
  occurredAt?: string | null
}

const NEXT_STEP: Record<string, string> = {
  submitted: 'Our review team will pick this up within 1–3 business days.',
  in_review: 'Initial review is in progress. We will move it to QC next.',
  qc_review: 'Quality Control is verifying technical specs and assets.',
  legal_review: 'Legal is verifying rights and certifications.',
  approved: 'Approved! It will move to Ready for Distribution next.',
  ready_for_distribution: 'Your title is now eligible for distribution.',
  published: 'Your title is now live on the platform.',
  changes_requested: 'Please review the note below and resubmit when ready.',
  rejected: 'Please review the note below for next steps.',
  hold: 'Your title has been paused. The team will follow up shortly.',
  archived: 'Your title has been archived.',
}

const Email = ({
  titleName = 'Your title',
  toStatus = 'submitted',
  toStatusLabel = 'Status updated',
  fromStatus,
  note,
  occurredAt,
}: Props) => {
  const stamp = occurredAt
    ? new Date(occurredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null
  const nextLine = NEXT_STEP[toStatus] ?? 'We will keep you posted on the next step.'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{titleName} — {toStatusLabel}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STREAMVISTA · TITLE UPDATE</Text>
          </Section>
          <Heading style={h1}>{toStatusLabel}</Heading>
          <Text style={p}><strong style={{ color: '#0f172a' }}>{titleName}</strong></Text>
          {fromStatus && (
            <Text style={pSmall}>
              {String(fromStatus).replace(/_/g, ' ')} → <strong>{String(toStatus).replace(/_/g, ' ')}</strong>
            </Text>
          )}
          {stamp && <Text style={pSmall}>{stamp}</Text>}
          {note && (
            <Section style={noteBox}>
              <Text style={noteLabel}>Note from review team</Text>
              <Text style={noteText}>{note}</Text>
            </Section>
          )}
          <Section style={nextBox}>
            <Text style={nextLabel}>What happens next</Text>
            <Text style={nextText}>{nextLine}</Text>
          </Section>
          <Hr style={hr} />
          <Text style={fineprint}>
            You can view full history and respond from your StreamVista dashboard.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => `${d?.titleName ?? 'Your title'} — ${d?.toStatusLabel ?? 'status updated'}`,
  displayName: 'Title status update',
  previewData: {
    titleName: 'Test Film',
    toStatus: 'in_review',
    toStatusLabel: 'Review started',
    fromStatus: 'submitted',
    note: null,
    occurredAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '28px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '24px', lineHeight: '1.25', margin: '0 0 12px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 8px' }
const pSmall = { fontSize: '13px', lineHeight: '1.6', margin: '0 0 6px', color: '#64748b' }
const noteBox = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 18px', margin: '16px 0' }
const noteLabel = { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#92400e', margin: '0 0 6px', fontWeight: 700 }
const noteText = { fontSize: '14px', color: '#78350f', margin: 0, lineHeight: '1.5' }
const nextBox = { backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '14px 18px', margin: '16px 0' }
const nextLabel = { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#075985', margin: '0 0 6px', fontWeight: 700 }
const nextText = { fontSize: '14px', color: '#0c4a6e', margin: 0, lineHeight: '1.5' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
