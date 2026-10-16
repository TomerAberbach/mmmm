import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { toBracketForm } from '../bracket-form.ts'
import type { BracketForm } from '../bracket-form.ts'
import { BracketSetupForm } from './bracket-setup-form.tsx'

const renderForm = async (defaultValue?: BracketForm) => {
  const Stub = createRoutesStub([
    {
      path: `/admin/bracket`,
      Component: () => (
        <BracketSetupForm year={2027} defaultValue={defaultValue} />
      ),
      action: () => null,
    },
  ])
  await render(<Stub initialEntries={[`/admin/bracket`]} />)
}

const division = (name: string) => page.getByRole(`group`, { name })

const pasteNames = async (count: number) => {
  await page.getByRole(`button`, { name: `Paste names` }).click()
  await userEvent.fill(
    page.getByLabelText(`Names`, { exact: true }),
    Array.from({ length: count }, (_, index) => `Combatant ${index + 1}`).join(
      `\n`,
    ),
  )
  await page.getByRole(`button`, { name: `Fill in the fields` }).click()
}

test(`an existing bracket fills the form, with no accessibility violations`, async () => {
  await renderForm(toBracketForm(BRACKET_2025))

  await expect
    .element(division(`top left`).getByLabelText(`Entrant 2`))
    .toHaveValue(`Flying Frog`)
  await expectNoAxeViolations()
})

test(`choosing the wild card's seed moves its entrants there`, async () => {
  await renderForm()

  await page.getByRole(`button`, { name: `Seed`, exact: false }).click()
  await page.getByRole(`option`, { name: `14`, exact: true }).click()

  await expect
    .element(division(`top left`).getByLabelText(`Seed 16`, { exact: true }))
    .toBeInTheDocument()
  await expect
    .element(division(`top left`).getByLabelText(`Seed 14`, { exact: true }))
    .not.toBeInTheDocument()
})

test(`pasted names fill the seeds, then the wild card's entrants`, async () => {
  await renderForm()

  await pasteNames(65)

  await expect
    .element(division(`bottom left`).getByLabelText(`Seed 1`, { exact: true }))
    .toHaveValue(`Combatant 16`)
  await expect
    .element(division(`top left`).getByLabelText(`Entrant 2`))
    .toHaveValue(`Combatant 65`)
})

test(`a paste with too few names fills nothing`, async () => {
  await renderForm()

  await pasteNames(64)

  await expect
    .element(page.getByText(`Found 64 names. Paste 65`, { exact: false }))
    .toBeInTheDocument()
  await expect
    .element(division(`top left`).getByLabelText(`Seed 1`, { exact: true }))
    .toHaveValue(``)
})

test(`saving with problems lists them at the top, each linked to its field`, async () => {
  await renderForm()

  await page.getByRole(`button`, { name: `Save bracket` }).click()

  const link = page
    .getByRole(`region`, { name: `Fix these to save` })
    .getByRole(`link`, { name: `Enter a name for the top left division` })
  const field = division(`top left`).getByLabelText(`Division name`)
  await expect.element(link).toHaveAttribute(`href`, `#${field.element().id}`)
})
