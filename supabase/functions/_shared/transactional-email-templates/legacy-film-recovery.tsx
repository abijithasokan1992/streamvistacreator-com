import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  displayName?: string
  filmCount?: number
  loginUrl?: string
  filmTitles?: string[]
}

const Email = ({
  displayName = 'Creator',
  filmCount = 1,
  loginUrl = 'https://streamvista.in/auth',
  filmTitles = [],
}: Props) => {
  const plural = filmCount === 1 ? 'film' : 'films'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        We've recovered your previously submitted {plural} — sign in to restore {filmCount === 1 ? 'it' : 'them'} as drafts.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>CRAYONS BRIDGE · CONTENT SUPPLY CHAIN</Text>
          </Section>
          <Heading style={h1}>Your legacy {plural} are ready to restore.</Heading>
          <Text style={p}>Hello {displayName},</Text>
          <Text style={p}>
            We've safely recovered <strong>{filmCount} {plural}</strong> you previously
            submitted and reserved them for this email address. When you sign in with
            a magic link, your titles will automatically appear as <strong>draft projects</strong> in
            your dashboard — no data has been lost.
          </Text>

          {filmTitles.length > 0 && (
            <Section style={metaBox}>
              <Text style={metaHead}>Reserved for you:</Text>
              {filmTitles.slice(0, 8).map((t, i) => (
                <Text key={i} style={metaItem}>• {t}</Text>
              ))}
              {filmTitles.length > 8 && (
                <Text style={metaItem}>…and {filmTitles.length - 8} more</Text>
              )}
            </Section>
          )}

          <Section style={ctaWrap}>
            <Button href={loginUrl} style={button}>Sign in and restore my {plural}</Button>
          </Section>

          <Heading style={h2}>To complete each submission</Heading>
          <Text style={li}>• Review your title information</Text>
          <Text style={li}>• Update any missing metadata (synopsis, cast, language)</Text>
          <Text style={li}>• Upload the latest master video and supporting files</Text>
          <Text style={li}>• Verify rights and ownership information</Text>
          <Text style={li}>• Submit for review when complete</Text>

          <Text style={p}>
            All information we had — synopsis, cast, crew, language, poster and trailer
            references — has been preserved wherever available. Your legacy data is
            reserved <strong>exclusively for this email address</strong> and cannot be accessed by anyone else.
          </Text>

          <Hr style={hr} />
          <Text style={fineprint}>
            Need help restoring your projects? Reply to this email and our team will help you.
          </Text>
          <Text style={fineprint}>
            Trouble with the button?{' '}
            <Link href={loginUrl} style={link}>{loginUrl}</Link>
          </Text>
          <Text style={fineprint}>Thank you, <br />The Crayons Bridge Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) =>
    `Your legacy ${(d?.filmCount ?? 1) === 1 ? 'film is' : 'films are'} ready to restore`,
  displayName: 'Legacy Film Recovery',
  previewData: {
    displayName: 'Jane',
    filmCount: 3,
    loginUrl: 'https://streamvista.in/auth',
    filmTitles: ['My First Film', 'Second Title', 'Third Story'],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#334155' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { padding: '12px 16px', backgroundColor: '#0f172a', borderRadius: '12px', marginBottom: '28px' }
const brandText = { color: '#22d3ee', fontSize: '11px', letterSpacing: '0.3em', margin: 0, fontWeight: 700 }
const h1 = { color: '#0f172a', fontSize: '22px', lineHeight: '1.3', margin: '0 0 16px', fontWeight: 800 }
const h2 = { color: '#0f172a', fontSize: '15px', margin: '20px 0 8px', fontWeight: 700 }
const p = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const li = { fontSize: '14px', lineHeight: '1.7', margin: '2px 0', color: '#334155' }
const ctaWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
  color: '#ffffff', padding: '14px 28px', borderRadius: '12px',
  fontWeight: 700, fontSize: '14px', letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, textDecoration: 'none', display: 'inline-block',
}
const metaBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', margin: '16px 0' }
const metaHead = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#64748b', margin: '0 0 6px', fontWeight: 700 }
const metaItem = { fontSize: '13px', margin: '3px 0', color: '#334155' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const fineprint = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '8px 0' }
const link = { color: '#0891b2', wordBreak: 'break-all' as const }
