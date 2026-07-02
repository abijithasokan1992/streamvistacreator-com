import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Link, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  invoiceNumber?: string
  description?: string
  subtotalInr?: number
  gstInr?: number
  totalInr?: number
  issuedAt?: string
  receiptUrl?: string
  billedToEmail?: string
}

const fmt = (n?: number) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const Email = ({
  invoiceNumber = 'INV-000000',
  description = 'StreamVista Creator Plan',
  subtotalInr = 0,
  gstInr = 0,
  totalInr = 0,
  issuedAt,
  receiptUrl,
  billedToEmail,
}: Props) => {
  const stamp = issuedAt
    ? new Date(issuedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Receipt {invoiceNumber} · {fmt(totalInr)} paid</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STREAMVISTA · PAYMENT RECEIPT</Text>
          </Section>
          <Heading style={h1}>Payment received</Heading>
          <Text style={p}>
            Thank you. Your payment for <strong style={{ color: '#0f172a' }}>{description}</strong> has been
            received and your storage entitlement is active.
          </Text>

          <Section style={cardBox}>
            <Row>
              <Column><Text style={lbl}>Invoice</Text><Text style={val}>{invoiceNumber}</Text></Column>
              <Column align="right"><Text style={lbl}>Date</Text><Text style={val}>{stamp ?? '—'}</Text></Column>
            </Row>
            {billedToEmail && (
              <Row><Column><Text style={lbl}>Billed to</Text><Text style={val}>{billedToEmail}</Text></Column></Row>
            )}
            <Hr style={hrLight} />
            <Row><Column><Text style={lbl}>Subtotal</Text></Column><Column align="right"><Text style={val}>{fmt(subtotalInr)}</Text></Column></Row>
            <Row><Column><Text style={lbl}>GST (18%)</Text></Column><Column align="right"><Text style={val}>{fmt(gstInr)}</Text></Column></Row>
            <Hr style={hrLight} />
            <Row><Column><Text style={total}>Total paid</Text></Column><Column align="right"><Text style={totalVal}>{fmt(totalInr)}</Text></Column></Row>
          </Section>

          {receiptUrl && (
            <Section style={{ textAlign: 'center', margin: '20px 0' }}>
              <Link href={receiptUrl} style={btn}>Download printable receipt (PDF)</Link>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={fineprint}>
            This receipt is a tax invoice issued by StreamVista. Keep it for your records.
          </Text>
                <BrandLogos />
      </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => `Receipt ${d?.invoiceNumber ?? ''} · payment received`,
  displayName: 'Invoice receipt',
  previewData: {
    invoiceNumber: 'INV-202606-001234',
    description: 'Creator Plan — 1 TB storage (Pay-As-You-Go)',
    subtotalInr: 650,
    gstInr: 117,
    totalInr: 767,
    issuedAt: new Date().toISOString(),
    receiptUrl: 'https://example.com/invoice/abc',
    billedToEmail: 'creator@example.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '28px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '24px', lineHeight: '1.25', margin: '0 0 12px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 8px' }
const cardBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', margin: '20px 0' }
const lbl = { fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#64748b', margin: '0 0 2px', fontWeight: 700 }
const val = { fontSize: '14px', color: '#0f172a', margin: '0 0 10px', fontWeight: 600 }
const total = { fontSize: '14px', color: '#0f172a', margin: '4px 0 0', fontWeight: 800 }
const totalVal = { fontSize: '18px', color: '#0f172a', margin: '4px 0 0', fontWeight: 800 }
const btn = { display: 'inline-block', backgroundColor: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const hrLight = { borderColor: '#e2e8f0', margin: '8px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
