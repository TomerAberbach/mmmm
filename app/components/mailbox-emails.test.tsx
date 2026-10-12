import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { MailboxEmails } from './mailbox-emails.tsx'

const EMAIL = {
  id: `1`,
  sentAt: new Date(`2026-03-17T15:00:00Z`),
  from: `MMMM <noreply@example.com>`,
  to: `ada@example.com`,
  subject: `Confirm your email`,
  html: `<p>Confirm your email</p>`,
  text: `Confirm your email http://localhost:3000/confirm`,
}

test(`the mailbox lists each email with its HTML and plain text`, async () => {
  await render(<MailboxEmails emails={[EMAIL]} />)

  await page.getByText(`Confirm your email`, { exact: true }).click()

  await expect
    .element(page.getByText(`to ada@example.com`, { exact: false }))
    .toBeVisible()
  await expect
    .element(page.getByTitle(`Confirm your email, as HTML`))
    .toHaveAttribute(`sandbox`, `allow-popups allow-popups-to-escape-sandbox`)
  await expect
    .element(page.getByText(`http://localhost:3000/confirm`, { exact: false }))
    .toBeVisible()
  await expectNoAxeViolations()
})
