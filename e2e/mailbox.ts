import type { Page } from '@playwright/test'

// Returns the plain text of each email to the address, newest first
export const readEmails = async (page: Page, to: string): Promise<string[]> => {
  await page.goto(`/dev/mailbox`)
  const emails = page.getByRole(`listitem`).filter({ hasText: ` to ${to},` })
  await emails.first().waitFor({ state: `attached` })
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
