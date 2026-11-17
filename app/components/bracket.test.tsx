import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  BRACKET_2017,
  BRACKET_2025,
  BRACKET_2026,
} from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { BracketInput } from '../bracket-input.ts'
import { buildBracketView } from '../bracket-view.ts'
import type { Winners } from '../bracket.ts'
import { toSeededBracket } from '../seeded-bracket.ts'
import { PRINTED_PAGE } from './bracket-diagram.tsx'
import { Bracket } from './bracket.tsx'

const PHONE = { width: 390, height: 844 }
const WIDE_SCREEN = { width: 1600, height: 1000 }

const tabPanel = () => page.getByRole(`tabpanel`)

const renderBracket = async (
  viewport: { width: number; height: number },
  {
    winners = {},
    year = 2025,
    bracket = BRACKET_2025,
  }: { winners?: Winners; year?: number; bracket?: BracketInput } = {},
) => {
  await page.viewport(viewport.width, viewport.height)
  await render(
    <Bracket
      view={buildBracketView(year, toSeededBracket(bracket), winners)}
    />,
  )
  await document.fonts.ready
}

// The names cut short by their box. A hidden name has no width, so it never
// counts
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
        `Round 1, battle 1: Thorold’s Deer vs. Olympic Marmot`,
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
  await renderBracket(PHONE, {
    winners: { 'ROUND_1:0': `Olympic Marmot` },
  })

  await expect
    .element(
      tabPanel().getByText(
        `Round 1, battle 1: Thorold’s Deer vs. Olympic Marmot, Olympic Marmot won`,
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

// Zooming rounds each element's size up. Chromium printed 2025's diagram 0.6%
// larger than its size times its zoom
const ROUNDING_GROWTH = 1.01

// The diagram's size once scaled by its print zoom
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
  { year: 2017, bracket: BRACKET_2017 },
  { year: 2025, bracket: BRACKET_2025 },
  { year: 2026, bracket: BRACKET_2026 },
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
