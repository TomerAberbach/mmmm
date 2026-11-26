import { expect, test } from 'vitest'
import { formatRank } from './leaderboard-row.ts'

test.each([
  [1, `1st`],
  [2, `2nd`],
  [3, `3rd`],
  [4, `4th`],
  [11, `11th`],
  [22, `22nd`],
  [112, `112th`],
])(`rank %i reads %s`, (rank, text) => {
  expect(formatRank(rank)).toBe(text)
})
