import type { Submission } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/play._index.ts'
import { isOpenYear } from '~/brackets.server.ts'
import { brokenLink } from '~/broken-link.ts'
import {
  NOT_OPEN_MESSAGE,
  ORPHANED_MESSAGE,
  PlayContestPage,
} from '~/components/play-contest.tsx'
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

/**
 * The prompt leaves the player's cookie as it is, because the next person on
 * a shared computer may be the one who sees it
 */
export const loader = async ({
  request,
  context,
}: Route.LoaderArgs): Promise<PlayView> => {
  const contest = readPlayContest(context)
  const [player, isOpen] = await Promise.all([
    readRememberedPlayer(request, contest.id),
    isOpenYear(contest.year),
  ])
  const takesPlayers = isOpen && contest.educatorName !== null
  if (player) {
    return {
      state: `returning`,
      displayName: player.displayName,
      bracketPath: href(`/player/:contestId/bracket`, {
        contestId: contest.id,
      }),
      isOpen: takesPlayers,
    }
  }
  return {
    state: takesPlayers ? `askName` : isOpen ? `orphaned` : `notOpen`,
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
    params.linkSecret,
    submission.value.displayName,
    () => limitNewPlayer(request, contest.id),
  )
  if (`refusal` in player) {
    if (player.refusal === `BROKEN_LINK`) {
      throw brokenLink()
    }
    if (player.refusal === `CONTEST_DELETED`) {
      return redirect(href(`/contest-removed`))
    }
    return player.refusal === `LIMITED`
      ? rejectTooManyNewPlayers(submission, player.limit)
      : rejectForm(submission, {
          formErrors: [
            player.refusal === `ORPHANED` ? ORPHANED_MESSAGE : NOT_OPEN_MESSAGE,
          ],
        })
  }
  return redirect(
    href(`/player/:contestId/bracket`, { contestId: contest.id }),
    {
      headers: {
        'Set-Cookie': await rememberPlayer(contest.id, player.secret),
      },
    },
  )
}

const rejectTooManyNewPlayers = (
  submission: Submission<unknown>,
  { message, headers }: LimitRefusal,
) => rejectForm(submission, { formErrors: [message] }, { status: 429, headers })

const PlayPage = ({ loaderData, actionData, params }: Route.ComponentProps) => (
  <div className='max-w-xl'>
    <PlayContestPage
      view={loaderData}
      reportPath={href(`/play/:linkSecret/report`, params)}
      lastResult={actionData?.result}
    />
  </div>
)
export default PlayPage
