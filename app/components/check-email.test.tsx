import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { CheckEmail } from './check-email.tsx'

test(`resending the link sends the address and says when`, async () => {
  const resentTo: unknown[] = []
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => <CheckEmail email='ada@school.org' reason='signed-up' />,
    },
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

test(`an unconfirmed educator is told to confirm before signing in`, async () => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => (
        <CheckEmail email='ada@school.org' reason='unconfirmed' />
      ),
    },
  ])

  await render(<Stub />)

  await expect
    .element(
      page.getByText(`Confirm your address before you sign in`, {
        exact: false,
      }),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a refused resend says why`, async () => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => <CheckEmail email='ada@school.org' reason='signed-up' />,
    },
    {
      path: `/resend-confirmation`,
      action: () => ({ error: `Too many attempts. Try again in 60 minutes.` }),
    },
  ])
  await render(<Stub />)

  await page.getByRole(`button`, { name: `Resend email` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`Too many attempts. Try again in 60 minutes.`)
  await expectNoAxeViolations()
})
