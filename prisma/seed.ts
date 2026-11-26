import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import {
  readBracket,
  saveUnpublishedBracket,
  setBracketPublished,
} from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import type {
  PlayerDeleter,
  SubmissionStatus,
} from '../app/generated/prisma/client.ts'
import { readArrangement } from '../app/moves.ts'
import { submitPlayerPicks } from '../app/player-picks.server.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import { deleteContest } from '../app/trash.server.ts'
import { readUpcomingYear } from '../app/year.ts'
import { BRACKET_2025, BRACKET_2026 } from './brackets.ts'
import { addContest, addPlayer } from './fixtures.ts'
import { requireDisposableDatabase } from './local-database.ts'
import { pickEveryBattle } from './pick-every-battle.ts'

// Everyone knows the seeded password
requireDisposableDatabase()

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
// year's is unpublished, as a new bracket starts, and the admin can publish it
// once 2025 has a champion. It takes 2026's names
if (!(await prisma.bracket.findUnique({ where: { year: 2025 } }))) {
  await saveUnpublishedBracket(2025, BRACKET_2025)
}
await setBracketPublished(2025, true)
const upcomingYear = readUpcomingYear(new Date())
if (!(await prisma.bracket.findUnique({ where: { year: upcomingYear } }))) {
  await saveUnpublishedBracket(upcomingYear, BRACKET_2026)
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
  const bracket = (await readBracket(year))!
  const picks = pickEveryBattle(toSeededBracket(bracket))
  const arrangement = readArrangement(bracket)
  const players: [string, SubmissionStatus | null, PlayerDeleter?][] = [
    [`Ava L.`, `APPROVED`],
    [`Ben T.`, `APPROVED`],
    [`Maya R.`, `PENDING`],
    [`Jonah K.`, `PENDING`],
    [`Priya S.`, `PENDING`],
    [`Ninja Cat`, `REJECTED`],
    [`maya r`, `PENDING`],
    [`Leo M.`, null],
    [`Sam T.`, `APPROVED`, `EDUCATOR`],
    [`Zoe B.`, null, `PLAYER`],
  ]
  for (const [displayName, status, deletedBy] of players) {
    const { id } = await addPlayer(contestId, displayName)
    if (status) {
      const submitted = await submitPlayerPicks(id, picks, arrangement)
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
    if (deletedBy) {
      await prisma.player.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy },
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
  await seedPlayers(await addContest(educator.id, `Period 2 Biology`))
  await addContest(educator.id, `Period 5 Biology`)
  await deleteContest(
    educator.id,
    await addContest(educator.id, `Period 7 Biology`),
  )
}
await prisma.$disconnect()
