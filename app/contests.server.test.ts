import { expect, test } from 'vitest'
import { addContest } from '../test/contests.ts'
import { createEducator } from '../test/educators.ts'
import { withCurrentYear } from '../test/years.ts'
import {
  readContestByLink,
  readEducatorContest,
  readEducatorContests,
  renameContest,
} from './contests.server.ts'

const readLinkSecret = (link: string): string =>
  new URL(link).pathname.replace(`/play/`, ``)

test(`an educator's contests in a year are listed oldest first`, () =>
  withCurrentYear(async addYear => {
    const educatorId = await createEducator()
    const year = await addYear({ published: true })
    await addContest(educatorId, `Period 2 Biology`)
    await addContest(educatorId, `Period 5 Biology`)
    await addYear({ published: true })
    await addContest(educatorId, `Science Club`)

    const contests = await readEducatorContests(educatorId, year)

    expect(contests.map(({ name }) => name)).toStrictEqual([
      `Period 2 Biology`,
      `Period 5 Biology`,
    ])
  }))

test(`a contest is created in the newest published year, before a newer unpublished one`, () =>
  withCurrentYear(async addYear => {
    const educatorId = await createEducator()
    const year = await addYear({ published: true })
    await addYear({ published: false })

    const contestId = await addContest(educatorId, `Period 2 Biology`)

    await expect(
      readEducatorContest(educatorId, contestId),
    ).resolves.toMatchObject({ yearId: year })
  }))

test(`a contest's link shows the contest and its educator`, () =>
  withCurrentYear(async addYear => {
    const educatorId = await createEducator(`Ms. Rivera`)
    const year = await addYear({ published: true })
    const contestId = await addContest(educatorId, `Period 6 Biology`)
    const { link } = (await readEducatorContest(educatorId, contestId))!

    const contest = await readContestByLink(readLinkSecret(link))

    expect(contest).toStrictEqual({
      id: contestId,
      name: `Period 6 Biology`,
      yearId: year,
      educatorName: `Ms. Rivera`,
    })
  }))

test(`each contest gets its own link`, () =>
  withCurrentYear(async addYear => {
    const educatorId = await createEducator()
    const year = await addYear({ published: true })
    await addContest(educatorId, `Period 2 Biology`)
    await addContest(educatorId, `Period 5 Biology`)

    const [first, second] = await readEducatorContests(educatorId, year)

    expect(first!.link).not.toBe(second!.link)
  }))

test(`a link that matches no contest shows nothing`, async () => {
  await expect(readContestByLink(`not-a-contest-link`)).resolves.toBeNull()
})

test(`renaming a contest changes the name its link shows`, () =>
  withCurrentYear(async addYear => {
    const educatorId = await createEducator()
    await addYear({ published: true })
    const contestId = await addContest(educatorId, `Period 2 Biology`)

    const renamed = await renameContest(
      educatorId,
      contestId,
      `Period 3 Biology`,
    )

    expect(renamed).toBe(true)
    const { link } = (await readEducatorContest(educatorId, contestId))!
    await expect(
      readContestByLink(readLinkSecret(link)),
    ).resolves.toMatchObject({ name: `Period 3 Biology` })
  }))

test(`another educator can't read or rename a contest`, () =>
  withCurrentYear(async addYear => {
    const educatorId = await createEducator()
    const otherEducatorId = await createEducator()
    await addYear({ published: true })
    const contestId = await addContest(educatorId, `Period 2 Biology`)

    const read = await readEducatorContest(otherEducatorId, contestId)
    const renamed = await renameContest(otherEducatorId, contestId, `Mine now`)

    expect(read).toBeNull()
    expect(renamed).toBe(false)
    await expect(
      readEducatorContest(educatorId, contestId),
    ).resolves.toMatchObject({ name: `Period 2 Biology` })
  }))
