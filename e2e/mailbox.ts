import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Returns the plain text of each email to the address, newest first. Reloads
// until one arrives, or until the newest contains `newestContaining`, since
// some emails send after the response
export const readEmails = async (
  page: Page,
  to: string,
  { newestContaining }: { newestContaining?: string } = {},
): Promise<string[]> => {
  const emails = page.getByRole(`listitem`).filter({ hasText: ` to ${to},` })
  await expect(async () => {
    await page.goto(`/dev/mailbox`)
    await (newestContaining === undefined
      ? expect(emails.first()).toBeAttached({ timeout: 500 })
      : expect(emails.first()).toContainText(newestContaining, {
          timeout: 500,
        }))
  }).toPass()
  return emails.locator(`pre`).allTextContents()
}

// Returns the link on the line after an email action's label
export const readActionLink = (text: string, label: string): string => {
  const link = text.split(`${label}:\n`)[1]?.split(/\s/u)[0]
  if (!link) {
    throw new Error(`No "${label}" link in:\n${text}`)
  }
  return link
}
