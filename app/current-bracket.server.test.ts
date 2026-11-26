import { expect, test } from 'vitest'
import { addYear, setLocked } from '../test/years.ts'
import { setExpectedLockDate } from './brackets.server.ts'
import { readExpectedLockDate } from './current-bracket.server.ts'

const addYearWithExpectedLockDate = async () => {
  const year = await addYear({ published: true })
  await setExpectedLockDate(year, new Date(`2027-03-19T00:00:00Z`))
  return year
}

test(`an open year has its expected lock date`, async () => {
  const year = await addYearWithExpectedLockDate()

  const date = await readExpectedLockDate(year)

  expect(date).toBe(`March 19, 2027`)
})

test(`a locked year has no expected lock date`, async () => {
  const year = await addYearWithExpectedLockDate()
  await setLocked(year)

  const date = await readExpectedLockDate(year)

  expect(date).toBeNull()
})
