import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { CheckEmail } from './check-email.tsx'

test(`resending the link sends the address and says when`, async () => {
  const resentTo: unknown[] = []
  const Stub = createRoutesStub([
    { path: `/`, Component: () => <CheckEmail email='ada@school.org' /> },
    {
      path: `/resend-confirmation`,
      action: async ({ request }) => {
        resentTo.push((await request.formData()).get(`email`))
        return { sentAt: new Date() }
      },
    },
  ])
  await render(<Stub />)

  await page.getByRole(`button`, { name: `Resend email` }).click()

  await expect
    .element(page.getByRole(`status`))
    .toMatchTextContent(/Sent again at/u)
  expect(resentTo).toStrictEqual([`ada@school.org`])
  await expectNoAxeViolations()
})
