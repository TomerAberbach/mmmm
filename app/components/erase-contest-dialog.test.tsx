import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { EraseContestDialog } from './erase-contest-dialog.tsx'

test(`erasing a contest says how much goes and asks for its name`, async () => {
  const received: unknown[] = []
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <EraseContestDialog
          contest={{
            id: `period-2`,
            name: `Period 2 Biology`,
            playerCount: 24,
          }}
        />
      ),
    },
    {
      path: `/admin/contests/period-2/erase-contest`,
      action: async ({ request }) => {
        received.push(Object.fromEntries(await request.formData()))
        return { result: {} }
      },
    },
  ])
  await page.getByRole(`button`, { name: `Delete forever` }).click()
  const dialog = page.getByRole(`alertdialog`)
  await expect
    .element(dialog.getByText(/its 24 brackets, trash included/u))
    .toBeVisible()
  await expectNoAxeViolations()

  await dialog
    .getByLabelText(`Type Period 2 Biology to confirm`)
    .fill(`Period 2 Biology`)
  await dialog.getByRole(`button`, { name: `Delete forever` }).click()

  await expect
    .poll(() => received)
    .toStrictEqual([{ confirmation: `Period 2 Biology` }])
})
