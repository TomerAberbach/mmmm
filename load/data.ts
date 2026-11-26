import { randomUUID } from 'node:crypto'
import { listBattles, toBattleId } from '../app/bracket.ts'
import {
  readBracket,
  saveUnpublishedBracket,
  setBracketPublished,
} from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import { listContenders, pickWinner } from '../app/picks.ts'
import type { Picks } from '../app/picks.ts'
import { hashSecret } from '../app/secrets.server.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import type { SeededBracket } from '../app/seeded-bracket.ts'
import { BRACKET_2025 } from '../prisma/brackets.ts'

export const YEAR = 2025
const CONTEST_COUNT = 200
export const PLAYERS_PER_CONTEST = 100

export const toContestId = (index: number): string => `contest-${index}`
export const toLinkSecret = (index: number): string => `load-contest-${index}`
export const toPlayerSecret = (index: number): string => `load-player-${index}`

/** 200 contests of 20 organizations, each with 100 approved submissions */
export const fillDatabase = async (): Promise<void> => {
  await saveUnpublishedBracket(YEAR, BRACKET_2025)
  await setBracketPublished(YEAR, true)
  const bracket = toSeededBracket((await readBracket(YEAR))!)
  for (let index = 0; index < CONTEST_COUNT; index++) {
    const domain = `school-${index % 20}.edu`
    await prisma.educator.create({
      data: {
        id: `educator-${index}`,
        name: `Educator ${index}`,
        email: `educator-${index}@${domain}`,
        emailVerified: true,
        organization: {
          connectOrCreate: { where: { domain }, create: { domain } },
        },
        contests: {
          create: {
            id: toContestId(index),
            year: YEAR,
            name: `Period ${index}`,
            linkSecret: toLinkSecret(index),
          },
        },
      },
    })
  }
  const choices = [0, -1].map(side => pickEvery(bracket, side))
  for (let index = 0; index < CONTEST_COUNT; index++) {
    await fillContest(index, choices)
  }
}

/** Picks each battle's contender at the index, which can count from the end */
const pickEvery = (bracket: SeededBracket, at: number): Picks =>
  listBattles().reduce<Picks>(
    (picks, battle) =>
      pickWinner(
        bracket,
        picks,
        battle,
        listContenders(bracket, battle, picks).at(at)!.id,
      ).picks,
    {},
  )

const fillContest = async (
  contestIndex: number,
  choices: Picks[],
): Promise<void> => {
  const players = Array.from({ length: PLAYERS_PER_CONTEST }, (_, index) => {
    const playerIndex = contestIndex * PLAYERS_PER_CONTEST + index
    return {
      id: randomUUID(),
      contestId: toContestId(contestIndex),
      displayName: `Player ${playerIndex}`,
      personalLinkHash: hashSecret(toPlayerSecret(playerIndex)),
      linkVersion: 1,
    }
  })
  await prisma.player.createMany({ data: players })
  await prisma.submission.createMany({
    data: players.map(({ id }) => ({
      playerId: id,
      status: `APPROVED` as const,
      picksChangedAt: new Date(),
    })),
  })
  await prisma.pick.createMany({
    data: players.flatMap(({ id }, index) =>
      Object.entries(choices[index % choices.length]!).flatMap(
        ([key, combatantId]) =>
          ([`DRAFT`, `SUBMISSION`] as const).map(stage => ({
            playerId: id,
            stage,
            battleId: toBattleId(YEAR, key),
            combatantId,
          })),
      ),
    ),
  })
}
