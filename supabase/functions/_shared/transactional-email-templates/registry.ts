import type { ComponentType } from 'npm:react@18.3.1'
import { template as clientReviewInvite } from './client-review-invite.tsx'
import { template as systemMessageReport } from './system-message-report.tsx'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string | ((data: any) => string)
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'client-review-invite': clientReviewInvite,
  'system-message-report': systemMessageReport,
}
