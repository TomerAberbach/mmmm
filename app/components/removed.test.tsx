import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { formatLocalDate } from '../dates.ts'
import {
  DeletedBracket,
  DeletedOwnBracket,
  RemovedContest,
} from './removed.tsx'

const renderDeleted = async (
  props: Omit<Parameters<typeof DeletedBracket>[0], `isPast` | `isOrphaned`> & {
    isPast?: boolean
    isOrphaned?: boolean
  },
) => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <DeletedBracket isPast={false} isOrphaned={false} {...props} />
      ),
    },
  ])
}

test(`a bracket an educator deleted offers a new one`, async () => {
  await renderDeleted({
    restoreBy: null,
    contestPath: `/play/secret`,
    isOpen: true,
  })

  await expect
    .element(
      page.getByRole(`heading`, { name: `Your educator deleted this bracket` }),
    )
    .toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: `Start a new bracket` }))
    .toHaveAttribute(`href`, `/play/secret`)
  await expectNoAxeViolations()
})

test(`a bracket its player deleted says when it can be restored by`, async () => {
  const restoreBy = new Date(`2027-03-22T15:40:00Z`)

  await renderDeleted({
    restoreBy,
    contestPath: `/play/secret`,
    isOpen: true,
  })

  await expect
    .element(
      page.getByText(
        `It was deleted from its personal link. If that wasn’t you, ask your educator to restore it by ${formatLocalDate(restoreBy)}, or before next year’s bracket is published, if that’s sooner.`,
      ),
    )
    .toBeVisible()
})

test(`a contest that takes no players offers no new bracket`, async () => {
  await renderDeleted({ restoreBy: null, contestPath: null, isOpen: false })

  await expect.element(page.getByRole(`heading`)).toBeVisible()
  await expect.element(page.getByRole(`link`)).not.toBeInTheDocument()
})

test(`a past year's deleted bracket says only its own date`, async () => {
  const restoreBy = new Date(`2027-03-22T15:40:00Z`)

  await renderDeleted({
    restoreBy,
    contestPath: null,
    isOpen: false,
    isPast: true,
  })

  await expect
    .element(
      page.getByText(
        `ask your educator to restore it by ${formatLocalDate(restoreBy)}. This contest`,
        { exact: false },
      ),
    )
    .toBeVisible()
})

test.each([
  [
    `a bracket its player deleted`,
    () => (
      <DeletedBracket
        restoreBy={new Date(`2027-03-22T15:40:00Z`)}
        contestPath={null}
        isOpen={false}
        isPast={false}
        isOrphaned
      />
    ),
  ],
  [
    `the player's own deletion`,
    () => <DeletedOwnBracket contestPath={null} isPast={false} isOrphaned />,
  ],
  [
    `a bracket its educator deleted`,
    () => (
      <DeletedBracket
        restoreBy={null}
        contestPath={null}
        isOpen={false}
        isPast={false}
        isOrphaned
      />
    ),
  ],
  [`a deleted contest`, () => <RemovedContest isOrphaned />],
])(
  `%s of an orphaned contest says its educator can't restore it`,
  async (_, Page) => {
    await renderRoutes([{ path: `/`, Component: Page }])

    await expect
      .element(
        page.getByText(`Your educator left MMMM, so they can’t restore it.`, {
          exact: false,
        }),
      )
      .toBeVisible()
    await expect.element(page.getByText(/ask /iu)).not.toBeInTheDocument()
  },
)
