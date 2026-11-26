import { z } from 'zod'
import type { SelectOption } from './components/select-field.tsx'
import { ReportReason } from './generated/prisma/enums.ts'

/** What a report is about. A player's has the player's ID */
export type ReportTarget = SelectOption<string>

export const CONTEST_TARGET: ReportTarget = {
  id: `contest`,
  label: `The contest’s name`,
}

export const reportSchema = z.object({
  target: z.union([z.literal(CONTEST_TARGET.id), z.uuid()]),
  reason: z.enum(ReportReason),
})

export const REASON_LABELS: Record<ReportReason, string> = {
  RUDE: `Rude or hurtful`,
  FULL_NAME: `Someone’s full name`,
  NOT_REAL: `Not a real player`,
  OTHER: `Something else`,
}
