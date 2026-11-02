import type { Submission } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/play._index.ts'
import { CONTEST_CLOSED, PlayContestPage } from '~/components/play-contest.tsx'
import type { PlayView } from '~/components/play-contest.tsx'
import { toBracketPath, toContestPath } from '~/paths.ts'
import { readPlayContest } from '~/play-context.server.ts'
import {
  forgetPlayer,
  readRememberedPlayer,
  rememberPlayer,
} from '~/player-cookie.server.ts'
import { serverDisplayNameSchema } from '~/player-forms.server.ts'
import { limitNewPlayer } from '~/player-limits.server.ts'
import { createPlayer, isTakingPlayers } from '~/players.server.ts'
import { rejectSubmission } from '~/reject-submission.server.ts'

// The prompt leaves the player's cookie as it is, because the next person on
// a shared computer may be the one who sees it
export const loader = async ({
  request,
  params,
  context,
}: Route.LoaderArgs): Promise<PlayView> => {
  const contest = readPlayContest(context)
  const player = await readRememberedPlayer(request, contest.id)
  if (player) {
    return {
      state: `returning`,
      displayName: player.displayName,
      bracketPath: toBracketPath(params.linkSecret),
    }
  }
  return {
    state: (await isTakingPlayers(contest.yearId)) ? `askName` : `closed`,
  }
}

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const contest = readPlayContest(context)
  const formData = await request.formData()
  if (formData.get(`intent`) === `not-you`) {
    return redirect(toContestPath(params.linkSecret), {
      headers: { 'Set-Cookie': await forgetPlayer(contest.id) },
    })
  }

  const submission = parseWithZod(formData, {
    schema: serverDisplayNameSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  // Publishing a newer bracket between this check and the insert can let one
  // last player in, which is harmless
  if (!(await isTakingPlayers(contest.yearId))) {
    return rejectSubmission(submission, { formErrors: [CONTEST_CLOSED] })
  }
  const refusal = await limitNewPlayer(request, contest.id)
  if (refusal) {
    return rejectTooManyNewPlayers(submission, refusal)
  }
  const secret = await createPlayer(contest.id, submission.value.displayName)
  return redirect(toBracketPath(params.linkSecret), {
    headers: { 'Set-Cookie': await rememberPlayer(contest.id, secret) },
  })
}

const rejectTooManyNewPlayers = (
  submission: Submission<unknown>,
  {
    message,
    retryAfterSeconds,
  }: { message: string; retryAfterSeconds: number },
) =>
  rejectSubmission(
    submission,
    { formErrors: [message] },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )

const PlayPage = ({ loaderData, actionData }: Route.ComponentProps) => (
  <PlayContestPage view={loaderData} lastResult={actionData?.result} />
)
export default PlayPage
