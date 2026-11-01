import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { createBracket, setBracketPublished } from '../app/brackets.server.ts'
import { createContest } from '../app/contests.server.ts'
import { prisma } from '../app/db.server.ts'
import { readUpcomingYear } from '../app/year.ts'
import { BRACKET_2025, BRACKET_2026 } from './brackets.ts'

// Staging asks for its own password first, so seeded educators can share an
// easy one. The seed skips sign-up, so sign-up's minimum length doesn't apply
const PASSWORD = `password`

// The admin is an admin only while `ADMIN_LIST` names its address, as
// `.env.example` does
const EDUCATORS = [
  { name: `Ada Lovelace`, email: `educator@example.com` },
  { name: `Grace Hopper`, email: `admin@example.com` },
]

// Creates the educator already confirmed, because signing up would email the
// address
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
if (!(await prisma.bracket.findUnique({ where: { yearId: 2025 } }))) {
  await createBracket(2025, BRACKET_2025)
}
await setBracketPublished(2025, true)
const upcomingYear = readUpcomingYear(new Date())
if (!(await prisma.bracket.findUnique({ where: { yearId: upcomingYear } }))) {
  await createBracket(upcomingYear, BRACKET_2026)
}

// The educator's contests in the current year, so the educator dashboard has some
const educator = await prisma.educator.findUniqueOrThrow({
  where: { email: EDUCATORS[0]!.email },
  select: { id: true, _count: { select: { contests: true } } },
})
if (educator._count.contests === 0) {
  for (const name of [`Period 2 Biology`, `Period 5 Biology`]) {
    await createContest(educator.id, 2025, name)
  }
}
await prisma.$disconnect()
