import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { saveUnpublishedBracket } from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import { PERFECT_SCORE } from '../app/scoring.ts'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { claimYear } from '../test/years.ts'
import { importOldData } from './import.ts'
import type { OldData } from './old-data.ts'
import { createOldWinners } from './old-fixtures.ts'

const createOldData = async (): Promise<
  OldData & { year: number; email: string }
> => {
  const year = await claimYear()
  const email = `${randomUUID()}@example.com`
  const teacherId = randomUUID()
  const classId = randomUUID()
  const createdAt = new Date(`2026-03-01T00:00:00Z`)
  const decided = JSON.stringify(createOldWinners({ decided: true }))
  return {
    year,
    email,
    brackets: [
      {
        year,
        createdAt,
        updatedAt: createdAt,
        topLeftDivision: `A`,
        bottomLeftDivision: `B`,
        topRightDivision: `C`,
        bottomRightDivision: `D`,
        winners: decided,
      },
    ],
    teachers: [{ id: teacherId, email: email.toUpperCase(), createdAt }],
    classes: [
      {
        id: classId,
        name: `Period 2`,
        bracketYear: year,
        teacherId,
        createdAt,
      },
    ],
    submissions: [
      {
        id: randomUUID(),
        name: `Maya R.`,
        approved: true,
        winners: decided,
        classId,
        createdAt,
      },
    ],
  }
}

/** The submission that `createOldData` makes, unless a test changes it */
const only = <Item>(items: Item[]): Item => items[0]!

const NOW = new Date(`2026-11-26T00:00:00Z`)

const run = (data: OldData) =>
  importOldData(data, { isDryRun: false, now: NOW })

const readPlayer = (id: string) =>
  prisma.player.findUnique({
    where: { id },
    select: {
      displayName: true,
      submission: { select: { status: true, score: true } },
      _count: { select: { picks: true } },
    },
  })

test(`a bracket, educator, contest, and submission are imported`, async () => {
  const data = await createOldData()

  const report = await run(data)

  expect(report).toStrictEqual({
    imported: { brackets: 1, educators: 1, contests: 1, submissions: 1 },
    skipped: {},
    changed: {},
  })
  await expect(
    prisma.educator.findUnique({
      where: { id: only(data.teachers).id },
      select: {
        email: true,
        emailVerified: true,
        organizationDomain: true,
        credentials: true,
        contests: { select: { id: true, name: true, year: true } },
      },
    }),
  ).resolves.toStrictEqual({
    email: data.email,
    emailVerified: false,
    organizationDomain: null,
    credentials: [],
    contests: [
      { id: only(data.classes).id, name: `Period 2`, year: data.year },
    ],
  })
  await expect(readPlayer(only(data.submissions).id)).resolves.toStrictEqual({
    displayName: `Maya R.`,
    submission: { status: `APPROVED`, score: PERFECT_SCORE },
    _count: { picks: 64 },
  })
  await expect(
    prisma.bracket.findUnique({
      where: { year: data.year },
      select: { publishedAt: true, lockedAt: true },
    }),
  ).resolves.toStrictEqual({
    publishedAt: only(data.brackets).createdAt,
    lockedAt: only(data.brackets).createdAt,
  })
})

test(`a dry run reports the same and changes nothing`, async () => {
  const data = await createOldData()

  const report = await importOldData(data, { isDryRun: true, now: NOW })

  expect(report.imported.submissions).toBe(1)
  await expect(readPlayer(only(data.submissions).id)).resolves.toBeNull()
  await expect(
    prisma.bracket.count({ where: { year: data.year } }),
  ).resolves.toBe(0)
})

test(`a rerun replaces the earlier import`, async () => {
  const data = await createOldData()
  await run(data)

  const report = await run({ ...data, submissions: [] })

  expect(report.imported).toMatchObject({ educators: 1, submissions: 0 })
  await expect(readPlayer(only(data.submissions).id)).resolves.toBeNull()
})

test(`a teacher who already signed up keeps their account`, async () => {
  const data = await createOldData()
  const id = randomUUID()
  await prisma.educator.create({
    data: { id, name: `Ms. Frizzle`, email: data.email, emailVerified: true },
  })

  const report = await run(data)

  expect(report.changed).toStrictEqual({
    'educator who already has an account': [only(data.teachers).id],
  })
  await expect(
    prisma.contest.count({ where: { educatorId: id } }),
  ).resolves.toBe(1)
})

test(`an unapproved submission is pending`, async () => {
  const data = await createOldData()
  data.submissions = [{ ...only(data.submissions), approved: false }]

  await run(data)

  await expect(readPlayer(only(data.submissions).id)).resolves.toMatchObject({
    submission: { status: `PENDING` },
  })
})

test(`names two years past their tournament are never stored`, async () => {
  const data = await createOldData()

  await importOldData(data, {
    isDryRun: false,
    now: new Date(Date.UTC(data.year + 2, 5)),
  })

  await expect(readPlayer(only(data.submissions).id)).resolves.toMatchObject({
    displayName: `Player`,
  })
})

test(`invalid rows are skipped, each with its reason`, async () => {
  const data = await createOldData()
  const other = createOldWinners({ decided: true })
  other[63] = `Someone else (1)`
  const submission = only(data.submissions)
  data.submissions = [
    { ...submission, id: `broken-${data.year}`, winners: `nope` },
    { ...submission, id: `other-${data.year}`, winners: JSON.stringify(other) },
  ]
  data.teachers.push({
    id: `invalid-${data.year}`,
    email: `not an address`,
    createdAt: NOW,
  })
  data.classes.push({
    ...only(data.classes),
    id: `orphan-${data.year}`,
    teacherId: `invalid-${data.year}`,
  })

  const report = await run(data)

  expect(report.skipped).toStrictEqual({
    'educator whose email address is invalid': [`invalid-${data.year}`],
    'contest of a skipped educator': [`orphan-${data.year}`],
    'submission whose picks are invalid': [`broken-${data.year}`],
    'submission of other combatants': [`other-${data.year}`],
  })
})

test(`names that don't fit are shortened`, async () => {
  const data = await createOldData()
  data.submissions = [{ ...only(data.submissions), name: `x`.repeat(40) }]

  const report = await run(data)

  await expect(readPlayer(only(data.submissions).id)).resolves.toMatchObject({
    displayName: `x`.repeat(30),
  })
  expect(report.changed).toStrictEqual({
    'name shortened or filled in': [only(data.submissions).id],
  })
})

test(`a year with contests of its own is left alone`, async () => {
  const data = await createOldData()
  await run(data)
  await prisma.contest.create({
    data: {
      id: randomUUID(),
      year: data.year,
      name: `New`,
      linkSecret: randomUUID(),
      educatorId: only(data.teachers).id,
    },
  })

  const report = await run(data)

  expect(report.skipped).toStrictEqual({
    'bracket of a year that already has one': [String(data.year)],
    'contest of a skipped bracket': [only(data.classes).id],
    'submission of a skipped contest': [only(data.submissions).id],
  })
  await expect(
    prisma.contest.count({ where: { year: data.year } }),
  ).resolves.toBe(2)
  await expect(readPlayer(only(data.submissions).id)).resolves.not.toBeNull()
})

test(`a bracket an admin set up is left alone`, async () => {
  const data = await createOldData()
  await saveUnpublishedBracket(data.year, BRACKET_2026)

  const report = await run(data)

  expect(report.imported.brackets).toBe(0)
  await expect(
    prisma.bracket.findUnique({
      where: { year: data.year },
      select: { publishedAt: true },
    }),
  ).resolves.toStrictEqual({ publishedAt: null })
})

test(`an unconfirmed sign-up with a teacher's address is replaced`, async () => {
  const data = await createOldData()
  const id = randomUUID()
  await prisma.educator.create({
    data: { id, name: `Ms. Frizzle`, email: data.email },
  })

  const report = await run(data)

  expect(report.imported.educators).toBe(1)
  await expect(
    prisma.educator.findUnique({ where: { id } }),
  ).resolves.toBeNull()
})

test(`teachers whose addresses differ only in case become one educator`, async () => {
  const data = await createOldData()
  const other = { ...only(data.teachers), id: randomUUID(), email: data.email }
  data.teachers.push(other)

  const report = await run(data)

  expect(report.imported).toMatchObject({ educators: 1, contests: 1 })
  expect(report.changed).toStrictEqual({
    'educator who already has an account': [other.id],
  })
})

test(`shortening a name drops a character it would split`, async () => {
  const data = await createOldData()
  data.submissions = [
    { ...only(data.submissions), name: `${`x`.repeat(29)}🦇` },
  ]

  await run(data)

  await expect(readPlayer(only(data.submissions).id)).resolves.toMatchObject({
    displayName: `x`.repeat(29),
  })
})

test(`the import can't rerun once an imported educator confirms their address`, async () => {
  const data = await createOldData()
  await run(data)
  await prisma.educator.update({
    where: { id: only(data.teachers).id },
    data: { emailVerified: true },
  })

  await expect(run({ ...data, submissions: [] })).rejects.toThrow(
    /can't rerun/u,
  )

  await expect(readPlayer(only(data.submissions).id)).resolves.not.toBeNull()
})
