import { parseWithZod } from '@conform-to/zod/v4'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { handOverSchema } from '../support-forms.ts'
import { HandOverDialog } from './hand-over-dialog.tsx'

/** Finds Grace Hopper, then hands the contest over to her */
const renderHandOver = async (hasOrganization = true) => {
  const received: unknown[] = []
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <HandOverDialog
          contest={{
            id: `period-2`,
            name: `Period 2 Biology`,
            isHidden: false,
            isInTrash: false,
          }}
        />
      ),
    },
    {
      path: `/admin/contests/hand-over`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: handOverSchema,
        })
        const value = submission.status === `success` ? submission.value : null
        received.push(value)
        return value?.educatorId === `grace`
          ? { result: submission.reply(), saved: true }
          : {
              result: submission.reply(),
              educator: { id: `grace`, name: `Grace Hopper`, hasOrganization },
            }
      },
    },
  ])
  await page.getByRole(`button`, { name: `Hand over Period 2 Biology` }).click()
  await page
    .getByLabelText(`New educator’s email address`)
    .fill(`grace@example.com`)
  return { received }
}

const find = () => page.getByRole(`button`, { name: `Find educator` }).click()

test(`the new educator is named before the contest is theirs`, async () => {
  const { received } = await renderHandOver()
  await expectNoAxeViolations()
  await find()

  await page.getByRole(`button`, { name: `Hand over to Grace Hopper` }).click()

  await expect.element(page.getByRole(`dialog`)).not.toBeInTheDocument()
  expect(received).toStrictEqual([
    { contestId: `period-2`, email: `grace@example.com` },
    { contestId: `period-2`, email: `grace@example.com`, educatorId: `grace` },
  ])
})

test.each([
  { isInTrash: true, isNoteShown: true },
  { isInTrash: false, isNoteShown: false },
])(
  `the dialog mentions restoring a contest only in the trash (in it: $isInTrash)`,
  async ({ isInTrash, isNoteShown }) => {
    await renderRoutes([
      {
        path: `/`,
        Component: () => (
          <HandOverDialog
            contest={{ id: `a`, name: `A`, isHidden: false, isInTrash }}
          />
        ),
      },
    ])

    await page.getByRole(`button`, { name: `Hand over A` }).click()

    await expect.element(page.getByRole(`dialog`)).toBeVisible()
    expect(
      page.getByText(`Handing it over restores it`, { exact: false }).elements()
        .length > 0,
    ).toBe(isNoteShown)
  },
)

test.each([
  {
    hasOrganization: true,
    text: /It then counts toward their organization\.$/u,
  },
  {
    hasOrganization: false,
    text: /They have no organization, so it counts toward none\.$/u,
  },
])(
  `the dialog says whether the contest counts toward an organization ($hasOrganization)`,
  async ({ hasOrganization, text }) => {
    await renderHandOver(hasOrganization)

    await find()

    await expect.element(page.getByText(text)).toBeVisible()
  },
)
