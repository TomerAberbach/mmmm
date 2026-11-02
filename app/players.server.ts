import { randomUUID } from 'node:crypto'
import { toBattleKey } from './bracket.ts'
import { readBracketRows, readCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { arePicksConsistent, toPickBracket } from './picks.ts'
import type { Picks } from './picks.ts'
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

export const readPlayerPicks = async (playerId: string): Promise<Picks> => {
  const picks = await prisma.pick.findMany({
    where: { playerId },
    select: {
      battle: { select: { round: true, index: true } },
      combatant: { select: { name: true } },
    },
  })
  return Object.fromEntries(
    picks.map(({ battle, combatant }) => [toBattleKey(battle), combatant.name]),
  )
}

// Replaces the player's picks in the year's bracket, and records when they
// changed. Resolves to false and changes nothing when the picks aren't
// consistent with the bracket
export const savePlayerPicks = async (
  playerId: string,
  yearId: number,
  picks: Picks,
): Promise<boolean> => {
  const bracket = await readBracketRows(yearId)
  if (!bracket || !arePicksConsistent(toPickBracket(bracket.input), picks)) {
    return false
  }
  // Updating the player first locks their row, so a concurrent save waits and
  // then deletes these picks instead of colliding with them
  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { picksChangedAt: new Date() },
    }),
    prisma.pick.deleteMany({ where: { playerId } }),
    prisma.pick.createMany({
      data: Object.entries(picks).map(([key, winner]) => ({
        playerId,
        battleId: bracket.battleIdByKey.get(key)!,
        combatantId: bracket.combatantIdByName.get(winner)!,
      })),
    }),
  ])
  return true
}
