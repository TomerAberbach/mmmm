import { parseWithZod } from '@conform-to/zod/v4'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { storeTestBracket } from '../../test/picks.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { renameSchema } from '../bracket-admin-forms.ts'
import { CombatantRenames } from './combatant-renames.tsx'

const BRACKET = storeTestBracket(BRACKET_2025)

/**
 * Renders the list with a rename action that refuses every name with `error`,
 * or saves it when there's none
 */
const renderRenames = async (error?: string) => {
  await renderRoutes(
    [
      {
        path: `/admin/bracket`,
        // A save reloads the page's data
        loader: () => ({}),
        HydrateFallback: () => null,
        Component: () => <CombatantRenames year={2026} bracket={BRACKET} />,
      },
      {
        path: `/admin/bracket/rename`,
        action: async ({ request }) => {
          const submission = parseWithZod(await request.formData(), {
            schema: renameSchema,
          })
          return error
            ? { result: submission.reply({ fieldErrors: { name: [error] } }) }
            : { result: submission.reply(), saved: true }
        },
      },
    ],
    `/admin/bracket`,
  )
}

test(`renaming one combatant keeps another's name open`, async () => {
  await renderRenames()

  await page.getByRole(`button`, { name: `Rename Gelada` }).click()
  await page.getByRole(`button`, { name: `Rename Sun Bear` }).click()

  await expect.element(page.getByLabelText(`New name for Gelada`)).toBeVisible()
  await expect
    .element(page.getByLabelText(`New name for Sun Bear`))
    .toHaveFocus()
  await expectNoAxeViolations()
})

test(`Escape closes the combatant's name without saving`, async () => {
  await renderRenames()
  await page.getByRole(`button`, { name: `Rename Sun Bear` }).click()

  // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- userEvent's key syntax
  await userEvent.keyboard(`{Escape}`)

  await expect
    .element(page.getByLabelText(`New name for Sun Bear`))
    .not.toBeInTheDocument()
})

test(`a refused rename shows why under the name`, async () => {
  await renderRenames(
    `Sun Bear is already a combatant. Give each combatant its own name`,
  )
  await page.getByRole(`button`, { name: `Rename Gelada` }).click()

  await userEvent.fill(page.getByLabelText(`New name for Gelada`), `sun bear`)
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(
      page.getByText(`Sun Bear is already a combatant`, { exact: false }),
    )
    .toBeVisible()
})

test(`the wild card's entrants are listed at its seed`, async () => {
  await renderRenames()

  const rows = page.getByRole(`listitem`)

  await expect
    .element(rows.filter({ hasText: `Northern Flying Squirrel` }))
    .toHaveTextContent(`14Northern Flying SquirrelWild cardRename`)
  await expect
    .element(rows.filter({ hasText: `Flying Frog` }))
    .toHaveTextContent(`14Flying FrogWild cardRename`)
})

test(`a division's rename sends its position`, async () => {
  const received: unknown[] = []
  await renderRoutes([
    {
      path: `/`,
      Component: () => <CombatantRenames year={2026} bracket={BRACKET} />,
    },
    {
      path: `/admin/bracket/rename-division`,
      action: async ({ request }) => {
        received.push(Object.fromEntries(await request.formData()))
        return { result: {}, saved: true }
      },
    },
  ])
  const { name } = BRACKET.divisions.TOP_LEFT
  await page.getByRole(`button`, { name: `Rename division ${name}` }).click()
  const field = page.getByLabelText(`New name for the ${name} division`)
  await expectNoAxeViolations()

  await field.fill(`New Name`)
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .poll(() => received)
    .toStrictEqual([{ year: `2026`, position: `TOP_LEFT`, name: `New Name` }])
})

test.each([
  [`canceling`, `Cancel`, false],
  [`saving`, `Save`, true],
])(`%s a rename returns focus to its button`, async (_, label, isSaved) => {
  await renderRenames()
  const rename = page.getByRole(`button`, { name: `Rename Sun Bear` })
  await rename.click()

  await page.getByRole(`button`, { name: label, exact: true }).click()

  await expect.element(rename).toHaveFocus()
  expect(page.getByText(`Saved`).elements().length > 0).toBe(isSaved)
})

test(`a rename's Saved goes once another saves`, async () => {
  await renderRenames()
  await page.getByRole(`button`, { name: `Rename Sun Bear` }).click()
  await page.getByRole(`button`, { name: `Save` }).click()
  await expect.element(page.getByText(`Saved`)).toBeVisible()
  await page.getByRole(`button`, { name: `Rename Gelada` }).click()

  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(page.getByRole(`listitem`).filter({ hasText: `Gelada` }))
    .toHaveTextContent(`8GeladaSavedRename`)
  await expect.poll(() => page.getByText(`Saved`).elements()).toHaveLength(1)
})
