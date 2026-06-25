import type { ComponentType } from 'npm:react@18.3.1'
import { template as clientReviewInvite } from './client-review-invite.tsx'
import { template as systemMessageReport } from './system-message-report.tsx'
import { template as welcomeAccountCreated } from './welcome-account-created.tsx'
import { template as loginAlert } from './login-alert.tsx'
import { template as titleStatusUpdate } from './title-status-update.tsx'
import { template as invoiceReceipt } from './invoice-receipt.tsx'
import { template as ingestAlert } from './ingest-alert.tsx'
import { template as inauguralActivation } from './inaugural-activation.tsx'

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
  'welcome-account-created': welcomeAccountCreated,
  'login-alert': loginAlert,
  'title-status-update': titleStatusUpdate,
  'invoice-receipt': invoiceReceipt,
  'ingest-alert': ingestAlert,
  'inaugural-activation': inauguralActivation,
}
