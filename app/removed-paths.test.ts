import { expect, test } from 'vitest'
import { readRemovedContext, toDeletedBracketPath } from './removed-paths.ts'

test.each([
  { isOrphaned: false, isPast: false },
  { isOrphaned: true, isPast: false },
  { isOrphaned: false, isPast: true },
  { isOrphaned: true, isPast: true },
])(`a deleted bracket's path keeps %o`, context => {
  const path = toDeletedBracketPath(context)

  expect(
    readRemovedContext(new Request(new URL(path, `https://mmmm.test`))),
  ).toStrictEqual(context)
})
