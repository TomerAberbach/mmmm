import type { ConfirmResult } from './form-replies.server.ts'
import { CONTEST_TARGET, reportSchema } from './report-forms.ts'
import { limitReport } from './report-limits.server.ts'
import { dismissReport, saveReport } from './reports.server.ts'
import type { ReportReader } from './reports.server.ts'

/**
 * Answers the report form. `findContestId` resolves to the contest of the player
 * or, for null, of the page, and to null for one the reporter can't see
 */
export const answerReport = async (
  request: Request,
  findContestId: (
    playerId: string | null,
  ) => string | null | Promise<string | null>,
): Promise<ConfirmResult> => {
  const refusal = await limitReport(request)
  if (refusal !== undefined) {
    return { error: refusal }
  }
  const { data } = reportSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!data) {
    return { error: `Choose what’s wrong with it` }
  }
  const playerId = data.target === CONTEST_TARGET.id ? null : data.target
  const contestId = await findContestId(playerId)
  const isSaved =
    contestId !== null &&
    (await saveReport({ contestId, playerId, reason: data.reason }))
  return isSaved
    ? { ok: true }
    : { error: `That isn’t here anymore. Reload the page` }
}

/** Answers Dismiss */
export const answerDismissal = async (
  request: Request,
  reader: ReportReader,
): Promise<ConfirmResult> => {
  const id = (await request.formData()).get(`id`)
  return typeof id === `string` && (await dismissReport(reader, id))
    ? { ok: true }
    : { error: `That report is gone. Reload the page` }
}
