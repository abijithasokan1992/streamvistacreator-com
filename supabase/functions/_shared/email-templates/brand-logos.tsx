/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Hr, Img, Section, Text } from 'npm:@react-email/components@0.0.22'

// Absolute URLs are required in email clients. Hosted via the project's
// published asset CDN so the logos render in Gmail / Outlook / Apple Mail.
const BASE = 'https://streamvistacreator.com'

const LOGOS = [
  { name: 'Crayons Pictures', src: `${BASE}/__l5e/assets-v1/5555a121-bd40-4126-be14-47370e1c5210/crayons-pictures.png` },
  { name: 'Crayons Bridge',   src: `${BASE}/__l5e/assets-v1/d6f6a6b8-1cdf-404b-8bf3-0c7b03349c78/crayons-bridge.png` },
  { name: 'Crayons Loop',     src: `${BASE}/__l5e/assets-v1/27bcc856-a282-449e-9b01-311b6bfd20bb/crayons-loop.png` },
]

export const BrandLogos = () => (
  <Section style={{ marginTop: '28px' }}>
    <Hr style={{ borderColor: '#eceef3', margin: '0 0 16px' }} />
    <Text style={{ fontSize: '11px', color: '#8a8f9c', letterSpacing: '0.16em', margin: '0 0 12px', textAlign: 'center' as const }}>
      A STREAMVISTA PARTNER NETWORK
    </Text>
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} align="center" style={{ margin: '0 auto' }}>
      <tbody>
        <tr>
          {LOGOS.map((l) => (
            <td key={l.name} style={{ padding: '0 10px', verticalAlign: 'middle' }}>
              <Img src={l.src} alt={l.name} height="28" style={{ display: 'block', height: '28px', width: 'auto' }} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  </Section>
)

export default BrandLogos
