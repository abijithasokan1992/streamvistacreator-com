import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  audience?: 'buyer' | 'founder'
  productName?: string
  priceLabel?: string
  quantity?: number
  entitlementSummary?: string
  buyerEmail?: string
  buyerName?: string
  paddleSubscriptionId?: string
  occurredAt?: string
  receiptUrl?: string
}

const Email = ({
  audience = 'buyer',
  productName = 'StreamVista plan',
  priceLabel = '',
  quantity = 1,
  entitlementSummary = '',
  buyerEmail = '',
  buyerName = '',
  paddleSubscriptionId = '',
  occurredAt,
  receiptUrl,
}: Props) => {
  const stamp = occurredAt
    ? new Date(occurredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const isFounder = audience === 'founder'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isFounder
          ? `New purchase · ${productName} · ${buyerEmail || 'unknown buyer'}`
          : `Welcome — ${productName} is active`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>
              {isFounder ? 'STREAMVISTA · FOUNDER ALERT' : 'STREAMVISTA · PURCHASE CONFIRMATION'}
            </Text>
          </Section>
          <Heading style={h1}>
            {isFounder ? 'New purchase received' : 'Thanks — your purchase is live'}
          </Heading>
          <Text style={p}>
            {isFounder
              ? `${buyerName || buyerEmail || 'A buyer'} just purchased ${productName}. Entitlement was granted automatically.`
              : `Your purchase of ${productName} has been received and the entitlement is now active on your account.`}
          </Text>

          <Section style={cardBox}>
            <Row><Column><Text style={lbl}>Product</Text><Text style={val}>{productName}</Text></Column>
              <Column align="right"><Text style={lbl}>When</Text><Text style={val}>{stamp}</Text></Column></Row>
            {priceLabel && (
              <Row><Column><Text style={lbl}>Price</Text><Text style={val}>{priceLabel}</Text></Column>
                <Column align="right"><Text style={lbl}>Quantity</Text><Text style={val}>{quantity}</Text></Column></Row>
            )}
            <Hr style={hrLight} />
            {entitlementSummary && (
              <Row><Column><Text style={lbl}>What you get</Text><Text style={val}>{entitlementSummary}</Text></Column></Row>
            )}
            {isFounder && buyerEmail && (
              <Row><Column><Text style={lbl}>Buyer</Text><Text style={val}>{buyerName ? `${buyerName} · ${buyerEmail}` : buyerEmail}</Text></Column></Row>
            )}
            {paddleSubscriptionId && (
              <Row><Column><Text style={lbl}>Reference</Text><Text style={val}>{paddleSubscriptionId}</Text></Column></Row>
            )}
          </Section>

          {!isFounder && receiptUrl && (
            <Text style={fineprint}>
              A printable receipt is available at <a href={receiptUrl} style={{ color: '#0f172a' }}>{receiptUrl}</a>.
            </Text>
          )}

          <Hr style={hr} />
          <Text style={fineprint}>
            {isFounder
              ? 'You are receiving this because you are listed as the StreamVista founder contact.'
              : 'Reply to this email if anything looks wrong — we are happy to help.'}
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
    d?.audience === 'founder'
      ? `New purchase · ${d?.productName ?? 'StreamVista'} · ${d?.buyerEmail ?? ''}`.trim()
      : `Welcome — ${d?.productName ?? 'your StreamVista plan'} is active`,
  displayName: 'Purchase confirmation',
  previewData: {
    audience: 'buyer',
    productName: 'Creator Pro',
    priceLabel: '$49.00 / month',
    quantity: 1,
    entitlementSummary: 'Creator role granted · up to 10 active titles',
    buyerEmail: 'creator@example.com',
    paddleSubscriptionId: 'sub_01h…',
    occurredAt: new Date().toISOString(),
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
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const hrLight = { borderColor: '#e2e8f0', margin: '8px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
