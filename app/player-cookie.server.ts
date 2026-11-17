import { createCookie } from 'react-router'
import { isServedOverHttps } from './env.server.ts'
import { readContestPlayer } from './players.server.ts'

// The player stays recognized for 15 minutes after their last request, so a
// player who closes the browser by accident can continue, while the next
// player on a shared computer usually starts fresh
const MAX_AGE_SECONDS = 15 * 60

// One cookie per contest, holding the player's personal link secret
const playerCookie = (contestId: string) =>
  createCookie(`player-${contestId}`, {
    httpOnly: true,
    sameSite: `lax`,
    secure: isServedOverHttps(),
    path: `/`,
    maxAge: MAX_AGE_SECONDS,
  })

const readPlayerSecret = async (
  request: Request,
  contestId: string,
): Promise<string | null> => {
  const secret: unknown = await playerCookie(contestId).parse(
    request.headers.get(`cookie`),
  )
  return typeof secret === `string` ? secret : null
}

// The player this browser remembers in the contest, or null when the cookie
// is missing or matches no player there
export const readRememberedPlayer = async (
  request: Request,
  contestId: string,
): Promise<{ secret: string; id: string; displayName: string } | null> => {
  const secret = await readPlayerSecret(request, contestId)
  const player = secret && (await readContestPlayer(contestId, secret))
  return player ? { secret, ...player } : null
}

// Also restarts the 15 minutes
export const rememberPlayer = (
  contestId: string,
  secret: string,
): Promise<string> => playerCookie(contestId).serialize(secret)

export const forgetPlayer = (contestId: string): Promise<string> =>
  playerCookie(contestId).serialize(``, { maxAge: 0 })
