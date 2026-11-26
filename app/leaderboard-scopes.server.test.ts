import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { addContest, addPlayer, addSubmission } from '../test/contests.ts'
import { createMember } from '../test/educators.ts'
import { addYear, setLocked } from '../test/years.ts'
import {
  findRankedContestId,
  readEducatorScopes,
  toContestScope,
} from './leaderboard-scopes.server.ts'

test(`a row's contest is found only on the reporter's leaderboards`, async () => {
  const year = await addYear({ published: true })
  const educatorId = await createMember(`${randomUUID()}.edu`)
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: approvedId } = await addPlayer(contestId)
  await addSubmission(approvedId, `APPROVED`)
  const { id: pendingId } = await addPlayer(contestId)
  await addSubmission(pendingId, `PENDING`)
  await setLocked(year)
  const scopes = await readEducatorScopes(educatorId, year)
  const otherScope = toContestScope({ id: `other`, name: `Other`, year })

  await expect(findRankedContestId(scopes, approvedId)).resolves.toBe(contestId)
  await expect(findRankedContestId(scopes, pendingId)).resolves.toBeNull()
  await expect(
    findRankedContestId([otherScope], approvedId),
  ).resolves.toBeNull()
})
