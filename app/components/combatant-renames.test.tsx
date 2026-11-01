import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renameSchema } from '../bracket-admin-forms.ts'
import { CombatantRenames } from './combatant-renames.tsx'

const DIVISIONS = [
  {
    position: `TOP_LEFT` as const,
    name: `Same & Different`,
    combatants: [
      { id: `deer`, name: `Thorold’s Deer`, seed: 1, isWildCardEntrant: false },
      { id: `bear`, name: `Sun Bear`, seed: 2, isWildCardEntrant: false },
    ],
  },
]

// Renders the list with a rename action that refuses every name with `error`,
// or saves it when there's none
const renderRenames = async (error?: string) => {
  const Stub = createRoutesStub([
    {
      path: `/admin/bracket`,
      Component: () => <CombatantRenames divisions={DIVISIONS} />,
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
  ])
  await render(<Stub initialEntries={[`/admin/bracket`]} />)
}

test(`renaming opens one combatant at a time`, async () => {
  await renderRenames()

  await page.getByRole(`button`, { name: `Rename Thorold’s Deer` }).click()
  await page.getByRole(`button`, { name: `Rename Sun Bear` }).click()

  await expect
    .element(page.getByLabelText(`New name for Thorold’s Deer`))
    .not.toBeInTheDocument()
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
