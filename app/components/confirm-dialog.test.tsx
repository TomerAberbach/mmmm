import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import type { ConfirmResult } from './confirm-dialog.tsx'

const SUCCESS: ConfirmResult = { ok: true }

const renderDialog = async (result: ConfirmResult = SUCCESS) => {
  const submittedContestIds: unknown[] = []
  const deleteContest = async ({ request }: { request: Request }) => {
    const form = await request.formData()
    submittedContestIds.push(form.get(`contestId`))
    return result
  }
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => (
        <ConfirmDialog
          trigger={<Button variant='danger'>Delete contest</Button>}
          title='Delete Period 5 Biology?'
          confirmLabel='Delete contest'
          action='/delete'
          fields={{ contestId: `5` }}
        >
          This moves the contest to the trash.
        </ConfirmDialog>
      ),
    },
    { path: `/delete`, action: deleteContest },
  ])
  await render(<Stub />)
  await page.getByRole(`button`, { name: `Delete contest` }).click()
  return { submittedContestIds }
}

test(`the dialog names the change and focuses Cancel`, async () => {
  await renderDialog()

  const dialog = page.getByRole(`alertdialog`, {
    name: `Delete Period 5 Biology?`,
  })
  await expect
    .element(dialog)
    .toHaveAccessibleDescription(`This moves the contest to the trash.`)
  await expect
    .element(dialog.getByRole(`button`, { name: `Cancel` }))
    .toHaveFocus()
  await expectNoAxeViolations()
})

test(`Escape closes the dialog without submitting`, async () => {
  const { submittedContestIds } = await renderDialog()

  // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- userEvent's key syntax
  await userEvent.keyboard(`{Escape}`)

  await expect.element(page.getByRole(`alertdialog`)).not.toBeInTheDocument()
  expect(submittedContestIds).toStrictEqual([])
})

test(`confirming submits the fields to the action and closes`, async () => {
  const { submittedContestIds } = await renderDialog()

  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Delete contest` })
    .click()

  await expect.element(page.getByRole(`alertdialog`)).not.toBeInTheDocument()
  expect(submittedContestIds).toStrictEqual([`5`])
})

test(`an error from the action keeps the dialog open and shows it`, async () => {
  await renderDialog({ error: `Contests with submissions can't be deleted` })

  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Delete contest` })
    .click()

  await expect
    .element(page.getByRole(`alertdialog`).getByRole(`alert`))
    .toHaveTextContent(`Contests with submissions can't be deleted`)
})
