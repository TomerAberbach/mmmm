import type { SubmissionStatus } from './generated/prisma/enums.ts'

/** A player's submission status as an educator sees it, or null for a draft */
export const describeStatus = (status: SubmissionStatus | null): string =>
  status ? STATUS_LABELS[status] : `Started, not submitted`

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  PENDING: `Pending`,
  APPROVED: `Approved`,
  REJECTED: `Rejected`,
}
