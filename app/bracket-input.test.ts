import { expect, test } from 'vitest'
import { BRACKET_2025 } from '../prisma/brackets.ts'
import { bracketInputSchema } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'

test(`a combatant entered twice is refused at each place, naming the other`, () => {
  const input: BracketInput = structuredClone(BRACKET_2025)
  input.divisions.BOTTOM_LEFT.combatants[1] = `Sun Bear`

  const issues = bracketInputSchema.safeParse(input).error?.issues

  expect(issues?.map(({ path, message }) => ({ path, message }))).toStrictEqual(
    [
      {
        path: [`divisions`, `TOP_LEFT`, `combatants`, 1],
        message: `Sun Bear is also seed 2 in THE ONLY ONES. Give each combatant its own name`,
      },
      {
        path: [`divisions`, `BOTTOM_LEFT`, `combatants`, 1],
        message: `Sun Bear is also seed 2 in SAME & DIFFERENT. Give each combatant its own name`,
      },
    ],
  )
})

test(`a division missing a combatant is refused without checking names`, () => {
  const input: BracketInput = structuredClone(BRACKET_2025)
  input.divisions.TOP_RIGHT.combatants.pop()
  input.divisions.BOTTOM_LEFT.combatants[1] = `Sun Bear`

  const issues = bracketInputSchema.safeParse(input).error?.issues

  expect(issues?.map(({ message }) => message)).toStrictEqual([
    `Give TUXEDO STYLE 16 combatants`,
  ])
})
