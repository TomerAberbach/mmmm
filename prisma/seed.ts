import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { listBattles } from '../app/bracket.ts'
import {
  readBracket,
  saveUnpublishedBracket,
  setBracketPublished,
} from '../app/brackets.server.ts'
import { createContest } from '../app/contests.server.ts'
import { prisma } from '../app/db.server.ts'
import type { SubmissionStatus } from '../app/generated/prisma/client.ts'
import { listContenders, pickWinner } from '../app/picks.ts'
import type { Picks } from '../app/picks.ts'
import { submitPlayerPicks } from '../app/player-picks.server.ts'
import { createPlayer, readContestPlayer } from '../app/players.server.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import type { SeededBracket } from '../app/seeded-bracket.ts'
import { readUpcomingYear } from '../app/year.ts'
import { BRACKET_2025, BRACKET_2026 } from './brackets.ts'

/**
 * Staging asks for its own password first, so seeded educators can share an
 * easy one. The seed skips sign-up, so sign-up's minimum length doesn't apply
 */
const PASSWORD = `password`

/**
 * The admin is an admin only while `ADMIN_LIST` names its address, as
 * `.env.example` does
 */
const EDUCATORS = [
  { name: `Ada Lovelace`, email: `educator@example.com` },
  { name: `Grace Hopper`, email: `admin@example.com` },
]

/**
 * Creates the educator already confirmed, because signing up would email the
 * address
 */
const seedEducator = async ({
  name,
  email,
}: {
  name: string
  email: string
}) => {
  const id = randomUUID()
  await prisma.educator.upsert({
    where: { email },
    update: { emailVerified: true },
    create: {
      id,
      name,
      email,
      emailVerified: true,
      credentials: {
        create: {
          id: randomUUID(),
          providerId: `credential`,
          accountId: id,
          password: await hashPassword(PASSWORD),
        },
      },
    },
  })
}

for (const educator of EDUCATORS) {
  await seedEducator(educator)
}

// 2025's is published, so it's the current year's bracket. The upcoming
// year's is unpublished, as a new bracket starts, so an admin can publish it.
// It takes 2026's names
if (!(await prisma.bracket.findUnique({ where: { year: 2025 } }))) {
  await saveUnpublishedBracket(2025, BRACKET_2025)
}
await setBracketPublished(2025, true)
const upcomingYear = readUpcomingYear(new Date())
if (!(await prisma.bracket.findUnique({ where: { year: upcomingYear } }))) {
  await saveUnpublishedBracket(upcomingYear, BRACKET_2026)
}

const pickFirstContenders = (bracket: SeededBracket): Picks =>
  listBattles().reduce<Picks>(
    (picked, battle) =>
      pickWinner(
        bracket,
        picked,
        battle,
        listContenders(bracket, battle)[0]!.id,
      ).picks,
    {},
  )

/** Returns the new player's ID */
const seedPlayer = async (
  contestId: string,
  displayName: string,
): Promise<string> => {
  const player = await createPlayer(contestId, displayName, () =>
    Promise.resolve(undefined),
  )
  if (!(`secret` in player)) {
    throw new Error(`The contest refused ${displayName}`)
  }
  return (await readContestPlayer(contestId, player.secret))!.id
}

/**
 * Players in every state, so the contest page lists each section. Each
 * submission picks the first contender of every battle
 */
const seedPlayers = async (contestId: string): Promise<void> => {
  const { year } = await prisma.contest.findUniqueOrThrow({
    where: { id: contestId },
    select: { year: true },
  })
  const picks = pickFirstContenders(toSeededBracket((await readBracket(year))!))
  const players: [string, SubmissionStatus | null][] = [
    [`Ava L.`, `APPROVED`],
    [`Ben T.`, `APPROVED`],
    [`Maya R.`, `PENDING`],
    [`Jonah K.`, `PENDING`],
    [`Priya S.`, `PENDING`],
    [`Ninja Cat`, `REJECTED`],
    [`Leo M.`, null],
  ]
  for (const [displayName, status] of players) {
    const id = await seedPlayer(contestId, displayName)
    if (status) {
      const submitted = await submitPlayerPicks(id, year, picks)
      if (`refusal` in submitted) {
        throw new Error(
          `The contest refused ${displayName}'s picks: ${submitted.refusal}`,
        )
      }
      await prisma.submission.update({
        where: { playerId: id },
        data: { status },
      })
    }
  }
}

// The educator's contests in the current year, so the educator dashboard has some
const educator = await prisma.educator.findUniqueOrThrow({
  where: { email: EDUCATORS[0]!.email },
  select: { id: true, _count: { select: { contests: true } } },
})
if (educator._count.contests === 0) {
  const period2Id = await createContest(educator.id, `Period 2 Biology`)
  await createContest(educator.id, `Period 5 Biology`)
  if (!period2Id) {
    throw new Error(`No current year takes contests`)
  }
  await seedPlayers(period2Id)
}
await prisma.$disconnect()
