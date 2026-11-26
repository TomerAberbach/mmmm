import type { SubmissionStatus } from './generated/prisma/enums.ts'

/** A player's submission status as an educator sees it, or null for a draft */
export const describeStatus = (
  status: SubmissionStatus | null,
  isOpen = true,
): string =>
  status
    ? STATUS_LABELS[status]
    : isOpen
      ? `Started, not submitted`
      : `Never submitted`

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  PENDING: `Pending`,
  APPROVED: `Approved`,
  REJECTED: `Rejected`,
}

/** A contest's sections of players in order, with null for drafts */
export const SUBMISSION_SECTIONS: (SubmissionStatus | null)[] = [
  `PENDING`,
  `APPROVED`,
  `REJECTED`,
  null,
]
