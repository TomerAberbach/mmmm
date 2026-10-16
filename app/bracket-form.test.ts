import { expect, test } from 'vitest'
import { BRACKET_2017, BRACKET_2025 } from '../prisma/brackets.ts'
import {
  bracketFormSchema,
  readPastedNames,
  toBracketForm,
  toBracketInput,
} from './bracket-form.ts'
import type { BracketForm } from './bracket-form.ts'

const editForm = (edit: (form: BracketForm) => void): BracketForm => {
  const form = toBracketForm(BRACKET_2025)
  edit(form)
  return form
}

const readProblems = (form: BracketForm) =>
  bracketFormSchema.safeParse(form).error?.issues.map(({ path, message }) => ({
    field: path.join(`.`),
    message,
  })) ?? []

test.each([
  { scenario: `2025's wild card at seed 14`, bracket: BRACKET_2025 },
  { scenario: `2017's 4 wild card entrants`, bracket: BRACKET_2017 },
])(`a bracket with $scenario survives the form`, ({ bracket }) => {
  const form = toBracketForm(bracket)

  const input = toBracketInput(bracketFormSchema.parse(form))

  expect(input).toStrictEqual(bracket)
})

test(`each blank name is reported at its own field, in the form's order`, () => {
  const form = editForm(form => {
    form.divisions.BOTTOM_RIGHT.name = ` `
    form.divisions.TOP_RIGHT.seeds[8] = ``
    form.wildCard.entrants[1] = ``
  })

  const problems = readProblems(form)

  expect(problems).toStrictEqual([
    {
      field: `wildCard.entrants.1`,
      message: `Enter a name for wild card entrant 2`,
    },
    {
      field: `divisions.TOP_RIGHT.seeds.8`,
      message: `Enter a name for seed 9 in TUXEDO STYLE`,
    },
    {
      field: `divisions.BOTTOM_RIGHT.name`,
      message: `Enter a name for the bottom right division`,
    },
  ])
})

test(`a combatant entered twice is reported at both fields`, () => {
  const form = editForm(form => {
    form.divisions.BOTTOM_LEFT.seeds[1] = `sun bear`
    form.wildCard.entrants[0] = `Addax`
  })

  const problems = readProblems(form)

  expect(problems).toStrictEqual([
    {
      field: `divisions.TOP_LEFT.seeds.1`,
      message: `Sun Bear is also seed 2 in THE ONLY ONES. Give each combatant its own name`,
    },
    {
      field: `wildCard.entrants.0`,
      message: `Addax is also seed 1 in THE ONLY ONES. Give each combatant its own name`,
    },
    {
      field: `divisions.BOTTOM_LEFT.seeds.0`,
      message: `Addax is also wild card entrant 1. Give each combatant its own name`,
    },
    {
      field: `divisions.BOTTOM_LEFT.seeds.1`,
      message: `sun bear is also seed 2 in SAME & DIFFERENT. Give each combatant its own name`,
    },
  ])
})

test(`a division name used twice is reported at both fields`, () => {
  const form = editForm(form => {
    form.divisions.TOP_RIGHT.name = `Same & Different`
  })

  const problems = readProblems(form)

  expect(problems).toStrictEqual([
    {
      field: `divisions.TOP_LEFT.name`,
      message: `SAME & DIFFERENT is also the top right division's name. Give each division its own name`,
    },
    {
      field: `divisions.TOP_RIGHT.name`,
      message: `Same & Different is also the top left division's name. Give each division its own name`,
    },
  ])
})

test(`the wild card's seed needs no name of its own`, () => {
  const form = editForm(form => {
    form.divisions.TOP_LEFT.seeds[13] = undefined
  })

  const problems = readProblems(form)

  expect(problems).toStrictEqual([])
})

const WILD_CARD = { position: `TOP_LEFT`, seed: 14, entrantCount: 2 } as const

const pasteLines = (count: number): string =>
  Array.from({ length: count }, (_, index) => `Combatant ${index + 1}`).join(
    `\n`,
  )

test(`pasted names fill the seeds division by division, then the entrants`, () => {
  const text = pasteLines(65)

  const result = readPastedNames(text, WILD_CARD) as {
    fields: [string, string][]
  }

  expect(Object.fromEntries(result.fields)).toMatchObject({
    'divisions.TOP_LEFT.seeds[0]': `Combatant 1`,
    'divisions.TOP_LEFT.seeds[14]': `Combatant 14`,
    'divisions.BOTTOM_LEFT.seeds[0]': `Combatant 16`,
    'wildCard.entrants[1]': `Combatant 65`,
  })
})

test(`blank lines in a paste don't count`, () => {
  const text = `\n${pasteLines(65).replaceAll(`\n`, `\n \n`)}\n`

  const result = readPastedNames(text, WILD_CARD)

  expect(result).toHaveProperty(`fields`)
})

test(`a paste with the wrong number of names says how many it needs`, () => {
  const text = pasteLines(63)

  const result = readPastedNames(text, WILD_CARD)

  expect(result).toStrictEqual({
    error: `Found 63 names. Paste 65: the 63 seeds and the 2 wild card entrants`,
  })
})
