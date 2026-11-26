import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.expected-lock-date.ts'
import { expectedLockDateSchema } from '~/bracket-admin-forms.ts'
import { setExpectedLockDate } from '~/brackets.server.ts'
import { fromIsoDate } from '~/dates.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    expectedLockDateSchema,
    async ({ year, expectedLockDate }) =>
      (await setExpectedLockDate(
        year,
        expectedLockDate ? fromIsoDate(expectedLockDate) : null,
      ))
        ? null
        : {
            formErrors: [
              `The ${year} bracket is locked or deleted. Reload the page`,
            ],
          },
  )
