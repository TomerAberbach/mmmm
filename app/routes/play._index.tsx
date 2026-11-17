import type { Submission } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/play._index.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { CONTEST_CLOSED, PlayContestPage } from '~/components/play-contest.tsx'
import type { PlayView } from '~/components/play-contest.tsx'
import { rejectForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import type { LimitRefusal } from '~/limits.server.ts'
import { readPlayContest } from '~/play-context.server.ts'
import {
  forgetPlayer,
  readRememberedPlayer,
  rememberPlayer,
} from '~/player-cookie.server.ts'
import { displayNameSchema } from '~/player-forms.ts'
import { limitNewPlayer } from '~/player-limits.server.ts'
import { createPlayer } from '~/players.server.ts'

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
      bracketPath: href(`/play/:linkSecret/bracket`, params),
    }
  }
  return {
    state: (await readCurrentYear()) === contest.yearId ? `askName` : `closed`,
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
    return redirect(href(`/play/:linkSecret`, params), {
      headers: { 'Set-Cookie': await forgetPlayer(contest.id) },
    })
  }

  const submission = parseWithZod(formData, {
    schema: displayNameSchema(serverFreeTextSchema),
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const player = await createPlayer(
    contest.id,
    submission.value.displayName,
    () => limitNewPlayer(request, contest.id),
  )
  if (`refusal` in player) {
    return player.refusal === `LIMITED`
      ? rejectTooManyNewPlayers(submission, player.limit)
      : rejectForm(submission, { formErrors: [CONTEST_CLOSED] })
  }
  return redirect(href(`/play/:linkSecret/bracket`, params), {
    headers: { 'Set-Cookie': await rememberPlayer(contest.id, player.secret) },
  })
}

const rejectTooManyNewPlayers = (
  submission: Submission<unknown>,
  { message, headers }: LimitRefusal,
) => rejectForm(submission, { formErrors: [message] }, { status: 429, headers })

const PlayPage = ({ loaderData, actionData }: Route.ComponentProps) => (
  <div className='max-w-xl'>
    <PlayContestPage view={loaderData} lastResult={actionData?.result} />
  </div>
)
export default PlayPage
