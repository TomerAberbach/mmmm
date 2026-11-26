import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { addSubmission } from '../test/contests.ts'
import { createEducator, createMember } from '../test/educators.ts'
import { crownChampion } from '../test/results.ts'
import { addYear } from '../test/years.ts'
import { setBracketPublished } from './brackets.server.ts'
import {
  renamePlayer,
  replacePersonalLink,
  setSubmissionStatus,
} from './contest-players.server.ts'
import { renameContest, replaceContestLink } from './contests.server.ts'
import { prisma } from './db.server.ts'
import {
  readPastYear,
  readPastYears,
  readRequiredYear,
} from './past-years.server.ts'
import { shareContest } from './shares.server.ts'
import {
  deleteContest,
  deleteOwnPlayer,
  deletePlayers,
  eraseContests,
  erasePlayers,
  restoreContests,
  restorePlayers,
} from './trash.server.ts'

/** A contest with a submission, and one in the trash, in a year that is past */
const createPastContest = async () => {
  const year = await addYear({ published: true })
  const educatorId = await createEducator()
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: playerId } = await addPlayer(contestId)
  await addSubmission(playerId, `APPROVED`)
  const { id: deletedId } = await addPlayer(contestId)
  await deletePlayers(educatorId, contestId, [deletedId])
  const deletedContestId = await addContest(educatorId, `Deleted`)
  await deleteContest(educatorId, deletedContestId)
  const currentYear = await addYear({ published: true })
  return {
    year,
    currentYear,
    educatorId,
    contestId,
    playerId,
    deletedId,
    deletedContestId,
  }
}

type PastContest = Awaited<ReturnType<typeof createPastContest>>

test.each<{
  change: string
  make: (past: PastContest) => Promise<unknown>
  refused: unknown
}>([
  {
    change: `renaming it`,
    make: past => renameContest(past.educatorId, past.contestId, `New`),
    refused: false,
  },
  {
    change: `replacing its contest link`,
    make: past => replaceContestLink(past.educatorId, past.contestId),
    refused: false,
  },
  {
    change: `deleting it`,
    make: past => deleteContest(past.educatorId, past.contestId),
    refused: false,
  },
  {
    change: `restoring a deleted one`,
    make: past => restoreContests(past.educatorId, [past.deletedContestId]),
    refused: 0,
  },
  {
    change: `erasing a deleted one`,
    make: past => eraseContests(past.educatorId, [past.deletedContestId]),
    refused: 0,
  },
  {
    change: `sharing it`,
    make: past => shareContest(past.educatorId, past.contestId, `a@b.edu`),
    refused: `NO_CONTEST`,
  },
  {
    change: `rejecting a submission`,
    make: past =>
      setSubmissionStatus(
        past.educatorId,
        past.contestId,
        [past.playerId],
        `REJECTED`,
      ),
    refused: 0,
  },
  {
    change: `renaming a player`,
    make: past =>
      renamePlayer(past.educatorId, past.contestId, past.playerId, `New`),
    refused: false,
  },
  {
    change: `replacing a personal link`,
    make: past =>
      replacePersonalLink(past.educatorId, past.contestId, past.playerId),
    refused: null,
  },
  {
    change: `deleting a player`,
    make: past =>
      deletePlayers(past.educatorId, past.contestId, [past.playerId]),
    refused: 0,
  },
  {
    change: `restoring a player`,
    make: past =>
      restorePlayers(past.educatorId, past.contestId, [past.deletedId]),
    refused: 0,
  },
  {
    change: `erasing a player`,
    make: past =>
      erasePlayers(past.educatorId, past.contestId, [past.deletedId]),
    refused: 0,
  },
])(`a past contest refuses $change`, async ({ make, refused }) => {
  const past = await createPastContest()

  await expect(make(past)).resolves.toBe(refused)
})

test(`a player can still delete their own past bracket`, async () => {
  const { playerId } = await createPastContest()

  await expect(deleteOwnPlayer(playerId)).resolves.toBe(true)
})

test(`publishing the next bracket erases the year's trash and drafts`, async () => {
  const year = await addYear({ published: true })
  const educatorId = await createEducator()
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: submittedId } = await addPlayer(contestId)
  await addSubmission(submittedId, `PENDING`)
  await addPlayer(contestId, `Draft`)
  const { id: deletedId } = await addPlayer(contestId, `Deleted`)
  await addSubmission(deletedId, `APPROVED`)
  await deletePlayers(educatorId, contestId, [deletedId])
  const deletedContestId = await addContest(educatorId, `Deleted`)
  await addSubmission((await addPlayer(deletedContestId)).id, `APPROVED`)
  await deleteContest(educatorId, deletedContestId)
  await crownChampion(year)
  const nextYear = await addYear({ published: false })

  await expect(setBracketPublished(nextYear, true)).resolves.toBe(`CHANGED`)

  const contests = await prisma.contest.findMany({
    where: { year },
    select: { id: true, players: { select: { id: true } } },
  })
  expect(contests).toStrictEqual([
    { id: contestId, players: [{ id: submittedId }] },
  ])
})

test(`a refused publication erases nothing`, async () => {
  await addYear({ published: true })
  const contestId = await addContest(await createEducator(), `Period 2 Biology`)
  const { id } = await addPlayer(contestId, `Draft`)
  const nextYear = await addYear({ published: false })

  await expect(setBracketPublished(nextYear, true)).resolves.toBe(`NO_CHAMPION`)

  await expect(prisma.player.count({ where: { id } })).resolves.toBe(1)
})

test(`past years list the champion and the educator's contests`, async () => {
  const year = await addYear({ published: true })
  const educatorId = await createEducator()
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  await addSubmission((await addPlayer(contestId)).id, `PENDING`)
  await addContest(await createEducator(), `Another educator's`)
  await crownChampion(year)
  const currentYear = await addYear({ published: true })

  const [newest] = await readPastYears(educatorId)

  expect(newest).toMatchObject({
    year,
    champion: expect.any(String) as string,
    contests: [
      {
        id: contestId,
        name: `Period 2 Biology`,
        sharedBy: null,
        submissionCount: 1,
      },
    ],
  })
  await expect(readPastYear(year)).resolves.toStrictEqual({ year, currentYear })
  await expect(readPastYear(currentYear)).resolves.toBeNull()
})

test.each([`0`, `abc`, `2026.5`, `2026.0`, `0x7EA`, `99999999999`])(
  `an address's year "%s" isn't found`,
  async param => {
    await expect(readRequiredYear(param)).rejects.toMatchObject({
      init: { status: 404 },
    })
  },
)

test(`an unpublished year isn't found`, async () => {
  const year = await addYear({ published: false })

  await expect(readRequiredYear(String(year))).rejects.toMatchObject({
    init: { status: 404 },
  })
})

test(`a past contest shared with a colleague stays in their past years`, async () => {
  const year = await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const ownerId = await createMember(domain)
  const colleagueId = await createMember(domain)
  const contestId = await addContest(ownerId, `Period 2 Biology`)
  await shareContest(ownerId, contestId, `${colleagueId}@${domain}`)
  await addYear({ published: true })

  const years = await readPastYears(colleagueId)

  expect(years.find(past => past.year === year)?.contests).toStrictEqual([
    {
      id: contestId,
      name: `Period 2 Biology`,
      sharedBy: `Ms. Frizzle`,
      submissionCount: 0,
    },
  ])
})

test(`an educator restores a past bracket its player deleted`, async () => {
  const { educatorId, contestId, playerId } = await createPastContest()
  await deleteOwnPlayer(playerId)

  await expect(restorePlayers(educatorId, contestId, [playerId])).resolves.toBe(
    1,
  )
})
