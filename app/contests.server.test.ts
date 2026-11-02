import { expect, test } from 'vitest'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { createEducator } from '../test/educators.ts'
import { createBracket, setBracketPublished } from './brackets.server.ts'
import {
  createContest,
  readContestByLink,
  readEducatorContest,
  readEducatorContests,
  renameContest,
} from './contests.server.ts'

// The test database is shared across this run, so each test uses years of its
// own, below the ones brackets.server.test.ts publishes as the current year
let nextYear = 2100

const addYear = async ({
  published,
}: {
  published: boolean
}): Promise<number> => {
  const year = nextYear++
  await createBracket(year, BRACKET_2026)
  await setBracketPublished(year, published)
  return year
}

const addContest = async (
  educatorId: string,
  year: number,
  name: string,
): Promise<string> => {
  const contestId = await createContest(educatorId, year, name)
  expect(contestId).not.toBeNull()
  return contestId!
}

const readLinkSecret = (link: string): string =>
  new URL(link).pathname.replace(`/play/`, ``)

test(`an educator's contests in a year are listed oldest first`, async () => {
  const educatorId = await createEducator()
  const year = await addYear({ published: true })
  const otherYear = await addYear({ published: true })
  await addContest(educatorId, year, `Period 2 Biology`)
  await addContest(educatorId, otherYear, `Science Club`)
  await addContest(educatorId, year, `Period 5 Biology`)

  const contests = await readEducatorContests(educatorId, year)

  expect(contests.map(({ name }) => name)).toStrictEqual([
    `Period 2 Biology`,
    `Period 5 Biology`,
  ])
})

test(`a contest's link shows the contest and its educator`, async () => {
  const educatorId = await createEducator(`Ms. Rivera`)
  const year = await addYear({ published: true })
  const contestId = await addContest(educatorId, year, `Period 6 Biology`)
  const { link } = (await readEducatorContest(educatorId, contestId))!

  const contest = await readContestByLink(readLinkSecret(link))

  expect(contest).toStrictEqual({
    id: contestId,
    name: `Period 6 Biology`,
    yearId: year,
    educatorName: `Ms. Rivera`,
  })
})

test(`each contest gets its own link`, async () => {
  const educatorId = await createEducator()
  const year = await addYear({ published: true })
  await addContest(educatorId, year, `Period 2 Biology`)
  await addContest(educatorId, year, `Period 5 Biology`)

  const [first, second] = await readEducatorContests(educatorId, year)

  expect(first!.link).not.toBe(second!.link)
})

test(`a link that matches no contest shows nothing`, async () => {
  await expect(readContestByLink(`not-a-contest-link`)).resolves.toBeNull()
})

test.each([
  { scenario: `an unpublished bracket`, hasBracket: true },
  { scenario: `no bracket`, hasBracket: false },
])(
  `a contest can't be created in a year with $scenario`,
  async ({ hasBracket }) => {
    const educatorId = await createEducator()
    const year = hasBracket ? await addYear({ published: false }) : nextYear++

    const contestId = await createContest(educatorId, year, `Period 2 Biology`)

    expect(contestId).toBeNull()
    await expect(readEducatorContests(educatorId, year)).resolves.toStrictEqual(
      [],
    )
  },
)

test(`renaming a contest changes the name its link shows`, async () => {
  const educatorId = await createEducator()
  const year = await addYear({ published: true })
  const contestId = await addContest(educatorId, year, `Period 2 Biology`)

  const renamed = await renameContest(educatorId, contestId, `Period 3 Biology`)

  expect(renamed).toBe(true)
  const { link } = (await readEducatorContest(educatorId, contestId))!
  await expect(readContestByLink(readLinkSecret(link))).resolves.toMatchObject({
    name: `Period 3 Biology`,
  })
})

test(`another educator can't read or rename a contest`, async () => {
  const educatorId = await createEducator()
  const otherEducatorId = await createEducator()
  const year = await addYear({ published: true })
  const contestId = await addContest(educatorId, year, `Period 2 Biology`)

  const read = await readEducatorContest(otherEducatorId, contestId)
  const renamed = await renameContest(otherEducatorId, contestId, `Mine now`)

  expect(read).toBeNull()
  expect(renamed).toBe(false)
  await expect(
    readEducatorContest(educatorId, contestId),
  ).resolves.toMatchObject({ name: `Period 2 Biology` })
})
