import { z } from 'zod'
import type { SelectOption } from './components/select-field.tsx'
import { ReportReason } from './generated/prisma/enums.ts'

/** What a report is about. A player's has the player's ID */
export type ReportTarget = SelectOption<string>

export const CONTEST_TARGET: ReportTarget = {
  id: `contest`,
  label: `The contest’s name`,
}

export const reportSchema = z
  .object({
    // An imported player's ID is a CUID, and any other's a UUID
    target: z.string().regex(/^[\da-z\-]{1,40}$/v),
    reason: z.enum(ReportReason),
  })
  .refine(({ target, reason }) => listReasons(target).includes(reason))

export const REASON_LABELS: Record<ReportReason, string> = {
  RUDE: `Rude or hurtful`,
  FULL_NAME: `Someone’s full name`,
  NOT_REAL: `Not a real player`,
  OTHER: `Something else`,
}

/** The reasons that fit the target, since only a player can be unreal */
export const listReasons = (target: string): ReportReason[] =>
  Object.values(ReportReason).filter(
    reason => target !== CONTEST_TARGET.id || reason !== ReportReason.NOT_REAL,
  )
