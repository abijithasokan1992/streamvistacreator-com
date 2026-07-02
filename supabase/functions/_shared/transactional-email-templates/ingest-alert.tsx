import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandLogos } from '../email-templates/brand-logos.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  workspaceName?: string
  ruleName?: string
  ruleType?: 'connection_drop' | 'error_spike' | 'low_throughput' | string
  summary?: string
  metrics?: Array<{ label: string; value: string }>
  firedAt?: string
  dashboardUrl?: string
}

const RULE_LABEL: Record<string, string> = {
  connection_drop: 'Connection drop',
  error_spike: 'Error spike',
  low_throughput: 'Low throughput',
}

const Email = ({
  workspaceName = 'your workspace',
  ruleName = 'Ingest alert',
  ruleType = 'connection_drop',
  summary = 'An ingest condition crossed your alert threshold.',
  metrics = [],
  firedAt,
  dashboardUrl = 'https://streamvistacreator.com/dashboard/studio',
}: Props) => {
  const when = firedAt
    ? new Date(firedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString()
  const label = RULE_LABEL[ruleType] ?? ruleType
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{label} — {ruleName} ({workspaceName})</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>STUDIO INGEST · ALERT</Text>
          </Section>
          <Heading style={h1}>{label}: {ruleName}</Heading>
          <Text style={p}>
            Workspace <strong>{workspaceName}</strong> · {when}
          </Text>
          <Text style={p}>{summary}</Text>
          {metrics.length > 0 && (
            <Section style={metaBox}>
              {metrics.map((m, i) => (
                <Text key={i} style={metaItem}>
                  <strong>{m.label}:</strong> {m.value}
                </Text>
              ))}
            </Section>
          )}
          <Section style={ctaWrap}>
            <a href={dashboardUrl} style={button}>Open Ingest Diagnostics</a>
          </Section>
          <Hr style={hr} />
          <Text style={fineprint}>
            You're receiving this because an Ingest Diagnostics alert rule fired in your workspace.
            Manage alert rules from Studio Ingest → Ingest Diagnostics. Powered by Crayons Bridge Ingest Engine.
          </Text>
                <BrandLogos />
      </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Props) => `[Studio Ingest] ${RULE_LABEL[data.ruleType ?? ''] ?? 'Alert'} · ${data.ruleName ?? ''}`,
  displayName: 'Ingest alert',
  previewData: {
    workspaceName: 'Crayons Pictures',
    ruleName: 'Shoot day failure spike',
    ruleType: 'error_spike',
    summary: '32% of ingest jobs failed in the last 60 minutes (threshold 20%).',
    metrics: [
      { label: 'Window', value: 'Last 60 min' },
      { label: 'Jobs evaluated', value: '12' },
      { label: 'Failed', value: '4' },
      { label: 'Failure rate', value: '32%' },
    ],
    firedAt: new Date().toISOString(),
    dashboardUrl: 'https://streamvistacreator.com/dashboard/studio',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '24px' }
const brandText = { color: '#f59e0b', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '22px', lineHeight: '1.3', margin: '0 0 12px', fontWeight: 800 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const ctaWrap = { textAlign: 'center' as const, margin: '24px 0 8px' }
const button = {
  background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
  color: '#ffffff', padding: '12px 24px', borderRadius: '12px',
  fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, textDecoration: 'none', display: 'inline-block',
}
const metaBox = { backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px 18px', margin: '16px 0' }
const metaItem = { fontSize: '13px', margin: '4px 0', color: '#7c2d12' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
