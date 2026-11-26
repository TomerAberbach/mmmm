import { expect, test } from 'vitest'
import { reportSchema } from './report-forms.ts'

test.each([
  [`the contest's name`, `contest`],
  [`a player`, `0b0b7d2e-6a52-4d0c-9a5c-0f0d4b1c2a3e`],
  [`an imported player`, `clf3k2m9x0000qz8h1a2b3c4d`],
])(`a report can be about %s`, (_, target) => {
  const { success } = reportSchema.safeParse({ target, reason: `RUDE` })

  expect(success).toBe(true)
})
