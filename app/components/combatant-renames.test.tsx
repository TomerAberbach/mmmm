import { parseWithZod } from '@conform-to/zod/v4'
import type { ComponentProps } from 'react'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { renameSchema } from '../bracket-admin-forms.ts'
import { CombatantRenames } from './combatant-renames.tsx'

const DIVISIONS: ComponentProps<typeof CombatantRenames>[`divisions`] = [
  {
    position: `TOP_LEFT`,
    name: `Same & Different`,
    combatants: [
      { id: `deer`, name: `Thorold’s Deer`, seed: 1, isWildCardEntrant: false },
      { id: `bear`, name: `Sun Bear`, seed: 2, isWildCardEntrant: false },
    ],
  },
]

/**
 * Renders the list with a rename action that refuses every name with `error`,
 * or saves it when there's none
 */
const renderRenames = async (error?: string) => {
  await renderRoutes(
    [
      {
        path: `/admin/bracket`,
        Component: () => <CombatantRenames merges={[]} divisions={DIVISIONS} />,
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

  await page.getByRole(`button`, { name: `Rename Thorold’s Deer` }).click()
  await page.getByRole(`button`, { name: `Rename Sun Bear` }).click()

  await expect
    .element(page.getByLabelText(`New name for Thorold’s Deer`))
    .toBeVisible()
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
  await page.getByRole(`button`, { name: `Rename Thorold’s Deer` }).click()

  await userEvent.fill(
    page.getByLabelText(`New name for Thorold’s Deer`),
    `sun bear`,
  )
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(
      page.getByText(`Sun Bear is already a combatant`, { exact: false }),
    )
    .toBeVisible()
})
