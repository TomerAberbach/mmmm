import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { formatLocalDate } from '../dates.ts'
import { DeletedBracket } from './removed.tsx'

const renderDeleted = async (props: Parameters<typeof DeletedBracket>[0]) => {
  await renderRoutes([
    { path: `/`, Component: () => <DeletedBracket {...props} /> },
  ])
}

test(`a bracket an educator removed offers a new one`, async () => {
  await renderDeleted({
    restoreBy: null,
    contestPath: `/play/secret`,
    isOpen: true,
  })

  await expect
    .element(
      page.getByRole(`heading`, { name: `Your educator removed this bracket` }),
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
        `It was deleted from its personal link. If that wasn’t you, ask your educator to restore it by ${formatLocalDate(restoreBy)}.`,
      ),
    )
    .toBeVisible()
})

test(`a contest that takes no players offers no new bracket`, async () => {
  await renderDeleted({ restoreBy: null, contestPath: null, isOpen: false })

  await expect.element(page.getByRole(`heading`)).toBeVisible()
  await expect.element(page.getByRole(`link`)).not.toBeInTheDocument()
})
