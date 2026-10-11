import type { ConsoleMessage, Page } from '@playwright/test'

// Collects the text of the page's console messages that match the predicate,
// into an array that fills as the page logs them
export const collectConsoleMessages = (
  page: Page,
  matches: (message: ConsoleMessage) => boolean,
): string[] => {
  const messages: string[] = []
  page.on(`console`, message => {
    if (matches(message)) {
      messages.push(message.text())
    }
  })
  return messages
}
