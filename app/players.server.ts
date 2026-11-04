import { randomUUID } from 'node:crypto'
import { readCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

// Starts a player's draft in the contest, and returns their personal link's
// secret, which only the player's cookie and link keep. Check
// `isTakingPlayers` first
export const createPlayer = async (
  contestId: string,
  displayName: string,
): Promise<string> => {
  const secret = createSecret()
  await prisma.player.create({
    data: {
      id: randomUUID(),
      contestId,
      displayName,
      personalLinkHash: hashSecret(secret),
    },
  })
  return secret
}

// Only the current year's contests take new players
export const isTakingPlayers = async (yearId: number): Promise<boolean> =>
  (await readCurrentYear()) === yearId

// Null unless the secret is a player's personal link in the contest
export const readContestPlayer = (
  contestId: string,
  secret: string,
): Promise<{ id: string; displayName: string } | null> =>
  prisma.player.findFirst({
    where: { contestId, personalLinkHash: hashSecret(secret) },
    select: { id: true, displayName: true },
  })

// Null for a secret that matches no player
export const readPlayerByLink = async (
  secret: string,
): Promise<{ contestId: string; contestLinkSecret: string } | null> => {
  const player = await prisma.player.findUnique({
    where: { personalLinkHash: hashSecret(secret) },
    select: { contest: { select: { id: true, linkSecret: true } } },
  })
  return (
    player && {
      contestId: player.contest.id,
      contestLinkSecret: player.contest.linkSecret,
    }
  )
}
