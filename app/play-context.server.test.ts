import { href, RouterContextProvider } from 'react-router'
import { expect, test } from 'vitest'
import { addPlayer } from '../prisma/fixtures.ts'
import { addSubmission, createContestInNewYear } from '../test/contests.ts'
import { setLocked } from '../test/years.ts'
import type { SubmissionStatus } from './generated/prisma/client.ts'
import {
  loadContestById,
  requireApprovedPlayer,
  requirePlayer,
} from './play-context.server.ts'
import { rememberPlayer } from './player-cookie.server.ts'

/** Opens a page for approved players, in a locked year or an open one */
const openAsPlayer = async (
  status: SubmissionStatus | null,
  { isLocked }: { isLocked: boolean },
) => {
  const { contestId, year } = await createContestInNewYear()
  const { id, secret } = await addPlayer(contestId)
  if (status) {
    await addSubmission(id, status)
  }
  if (isLocked) {
    await setLocked(year)
  }
  const url = new URL(
    `https://mmmm.test/player/${contestId}/leaderboards/contest`,
  )
  const args = {
    request: new Request(url, {
      headers: { cookie: await rememberPlayer(contestId, secret) },
    }),
    url,
    params: { contestId },
    pattern: `/player/:contestId/leaderboards/:kind`,
    context: new RouterContextProvider(),
  }
  const opened = () => Promise.resolve(new Response(`Opened`))
  const response = await loadContestById(args, async () => {
    const reply = await requirePlayer(args, async () => {
      const approved = await requireApprovedPlayer(args, opened)
      return approved as Response
    })
    return reply as Response
  })
  return {
    location: (response as Response).headers.get(`Location`),
    bracketPath: href(`/player/:contestId/bracket`, { contestId }),
  }
}

test.each([
  [200, true],
  [409, false],
])(
  `a %i response restarts the remembered player's time: %s`,
  async (status, isRestarted) => {
    const { contestId } = await createContestInNewYear()
    const { secret } = await addPlayer(contestId)
    const url = new URL(`https://mmmm.test/player/${contestId}/bracket/picks`)
    const args = {
      request: new Request(url, {
        headers: { cookie: await rememberPlayer(contestId, secret) },
      }),
      url,
      params: { contestId },
      pattern: `/player/:contestId/bracket/picks`,
      context: new RouterContextProvider(),
    }

    const response = await loadContestById(args, async () => {
      const reply = await requirePlayer(args, () =>
        Promise.resolve(new Response(null, { status })),
      )
      return reply as Response
    })

    expect((response as Response).headers.has(`Set-Cookie`)).toBe(isRestarted)
  },
)

test(`an approved player's page opens once the year locks`, async () => {
  const { location } = await openAsPlayer(`APPROVED`, { isLocked: true })

  expect(location).toBeNull()
})

test.each<SubmissionStatus | null>([null, `PENDING`, `REJECTED`])(
  `a player whose submission's status is %s goes back to their bracket`,
  async status => {
    const { location, bracketPath } = await openAsPlayer(status, {
      isLocked: true,
    })

    expect(location).toBe(bracketPath)
  },
)

test(`an approved player goes back to their bracket while the year is open`, async () => {
  const { location, bracketPath } = await openAsPlayer(`APPROVED`, {
    isLocked: false,
  })

  expect(location).toBe(bracketPath)
})
