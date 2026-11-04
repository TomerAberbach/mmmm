import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub, useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { contestNameSchema } from '../contest-forms.ts'
import { freeTextSchema } from '../free-text.ts'
import { ContestDetails } from './contest-details.tsx'
import type { Contest } from '~/contests.server.ts'

// The action saves the name, and the loader reads it back
const renderContest = async () => {
  let contest: Contest = {
    id: `period-2`,
    name: `Period 2 Biology`,
    yearId: 2027,
    link: `https://mmmm.onl/play/secret`,
  }
  const Stub = createRoutesStub([
    {
      path: `/contests/period-2`,
      loader: () => contest,
      HydrateFallback: () => null,
      Component: () => <ContestDetails contest={useLoaderData<Contest>()} />,
    },
    {
      path: `/contests/period-2/name`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: contestNameSchema(freeTextSchema),
        })
        if (submission.status === `success`) {
          contest = { ...contest, name: submission.value.name }
        }
        return { result: submission.reply(), saved: true }
      },
    },
  ])
  await render(<Stub initialEntries={[`/contests/period-2`]} />)
}

test(`the contest link is shown beside its Copy button`, async () => {
  await renderContest()

  await expect
    .element(page.getByRole(`textbox`, { name: `Contest link` }))
    .toHaveValue(`https://mmmm.onl/play/secret`)
  await expect
    .element(page.getByRole(`button`, { name: `Copy link` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`the contest link's QR code shows on request`, async () => {
  await renderContest()

  await page.getByText(`Show a QR code`).click()

  await expect
    .element(page.getByRole(`img`, { name: `QR code for the contest link` }))
    .toBeVisible()
})

test(`renaming a contest shows its new name`, async () => {
  await renderContest()
  await page.getByRole(`button`, { name: `Rename` }).click()

  await userEvent.fill(page.getByLabelText(`Contest name`), `Period 3 Biology`)
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(page.getByRole(`heading`, { name: `Period 3 Biology` }))
    .toBeVisible()
  await expect.element(page.getByText(`Saved the contest name`)).toBeVisible()
})

test(`Escape closes the contest's name without saving`, async () => {
  await renderContest()
  await page.getByRole(`button`, { name: `Rename` }).click()
  await userEvent.fill(page.getByLabelText(`Contest name`), `Period 3 Biology`)

  // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- userEvent's key syntax
  await userEvent.keyboard(`{Escape}`)

  await expect
    .element(page.getByLabelText(`Contest name`))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`heading`, { name: `Period 2 Biology` }))
    .toBeVisible()
})
