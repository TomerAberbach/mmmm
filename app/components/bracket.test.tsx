import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  BRACKET_2017,
  BRACKET_2025,
  BRACKET_2026,
} from '../../prisma/brackets.ts'
import { pickEveryBattle } from '../../prisma/pick-every-battle.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { ROUND_1_FIRST, seedTestBracket } from '../../test/picks.ts'
import { buildBracketView, buildMarkedBracketView } from '../bracket-view.ts'
import type { Winners } from '../bracket.ts'
import type { Combatant, SeededBracket } from '../seeded-bracket.ts'
import { listContenders } from '../winners.ts'
import { PRINTED_PAGE } from './bracket-diagram.tsx'
import { Bracket } from './bracket.tsx'

const BRACKET = seedTestBracket(BRACKET_2025)
const [SEED_1, SEED_16] = listContenders(BRACKET, ROUND_1_FIRST) as [
  Combatant,
  Combatant,
]

const PHONE = { width: 390, height: 844 }
const WIDE_SCREEN = { width: 1600, height: 1000 }

const tabPanel = () => page.getByRole(`tabpanel`)

const renderBracket = async (
  viewport: { width: number; height: number },
  {
    winners = {},
    year = 2025,
    bracket = BRACKET,
    results,
  }: {
    winners?: Winners
    year?: number
    bracket?: SeededBracket
    results?: Winners
  } = {},
) => {
  await page.viewport(viewport.width, viewport.height)
  await render(
    <Bracket
      view={
        results
          ? buildMarkedBracketView(year, bracket, winners, results)
          : buildBracketView(year, bracket, winners)
      }
    />,
  )
  await document.fonts.ready
}

/**
 * The names cut short by their box. A hidden name has no width, so it never
 * counts
 */
const readOverflowingNames = (): string[] =>
  [...document.querySelectorAll<HTMLElement>(`[title]`)]
    .filter(name => name.scrollWidth > name.clientWidth)
    .map(name => name.title)

test(`a phone starts on Round 1`, async () => {
  await renderBracket(PHONE)

  await expect
    .element(page.getByRole(`tab`, { name: `Round 1` }))
    .toHaveAttribute(`aria-selected`, `true`)
  await expect
    .element(
      tabPanel().getByText(
        `Round 1, battle 1: ${SEED_1.name} vs. ${SEED_16.name}`,
      ),
    )
    .toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`a phone shows one round at a time`, async () => {
  await renderBracket(PHONE)

  await page.getByRole(`tab`, { name: `Wild card` }).click()

  await expect
    .element(
      tabPanel().getByText(
        `Wild card: Northern Flying Squirrel vs. Flying Frog`,
      ),
    )
    .toBeInTheDocument()
  await expect
    .element(tabPanel().getByText(`Round 1, battle 1:`, { exact: false }))
    .not.toBeInTheDocument()
})

test(`a battle's label names its winner`, async () => {
  await renderBracket(PHONE, { winners: { 'ROUND_1:0': SEED_16.id } })

  await expect
    .element(
      tabPanel().getByText(
        `Round 1, battle 1: ${SEED_1.name} vs. ${SEED_16.name}, ${SEED_16.name} won`,
      ),
    )
    .toBeInTheDocument()
})

test(`a wide screen reads every round under its own heading`, async () => {
  await renderBracket(WIDE_SCREEN)

  await expect
    .element(page.getByRole(`heading`, { name: `Championship` }))
    .toBeInTheDocument()
  await expect
    .element(page.getByRole(`tab`, { name: `Round 1` }))
    .not.toBeInTheDocument()
  await expectNoAxeViolations()
})

/**
 * Zooming rounds each element's size up. Chromium printed 2025's diagram 0.6%
 * larger than its size times its zoom
 */
const ROUNDING_GROWTH = 1.01

/** The diagram's size once scaled by its print zoom */
const readPrintedDiagramSize = () => {
  const diagram = document.querySelector<HTMLElement>(`[style*="--zoom"]`)!
  const zoom =
    Number(diagram.style.getPropertyValue(`--zoom`)) * ROUNDING_GROWTH
  return {
    width: diagram.offsetWidth * zoom,
    height: diagram.offsetHeight * zoom,
  }
}

const BRACKETS = [
  { year: 2017, bracket: seedTestBracket(BRACKET_2017) },
  { year: 2025, bracket: BRACKET },
  { year: 2026, bracket: seedTestBracket(BRACKET_2026) },
]

test.each(BRACKETS)(
  `every name in $year's diagram fits its box`,
  async ({ year, bracket }) => {
    await renderBracket(WIDE_SCREEN, { year, bracket })

    const overflowingNames = readOverflowingNames()

    expect(overflowingNames).toStrictEqual([])
  },
)

test.each(BRACKETS)(
  `$year's diagram prints on one page`,
  async ({ year, bracket }) => {
    await renderBracket(WIDE_SCREEN, { year, bracket })

    const { width, height } = readPrintedDiagramSize()

    expect(width).toBeLessThanOrEqual(PRINTED_PAGE.width)
    expect(height).toBeLessThanOrEqual(PRINTED_PAGE.height)
  },
)

test.each(BRACKETS)(
  `$year's marked diagram prints on one page`,
  async ({ year, bracket }) => {
    const winners = pickEveryBattle(bracket)
    await renderBracket(WIDE_SCREEN, {
      year,
      bracket,
      winners,
      results: { 'ROUND_1:0': winners[`ROUND_1:0`]! },
    })

    const { width, height } = readPrintedDiagramSize()

    expect(width).toBeLessThanOrEqual(PRINTED_PAGE.width)
    expect(height).toBeLessThanOrEqual(PRINTED_PAGE.height)
  },
)

test.each([
  { scenario: `results`, results: undefined, label: `2025 champion` },
  { scenario: `picks`, results: {}, label: `Champion pick` },
])(`a bracket of $scenario labels its champion`, async ({ results, label }) => {
  await renderBracket(WIDE_SCREEN, { results })

  await expect.element(page.getByText(label)).toBeVisible()
})

test(`a marked bracket starts on the earliest round left to decide`, async () => {
  await renderBracket(PHONE, {
    winners: pickEveryBattle(BRACKET),
    results: {},
  })

  await expect
    .element(page.getByRole(`tab`, { name: `Round 1` }))
    .toHaveAttribute(`aria-selected`, `true`)
})
