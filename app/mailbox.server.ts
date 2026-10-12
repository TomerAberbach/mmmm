import { randomUUID } from 'node:crypto'

export type RenderedEmail = {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

export type MailboxEmail = RenderedEmail & { id: string; sentAt: Date }

const MAX_EMAILS = 100
const emails: MailboxEmail[] = []

// Keeps sent emails in memory, newest first
export const saveToMailbox = (email: RenderedEmail): void => {
  emails.unshift({ id: randomUUID(), sentAt: new Date(), ...email })
  emails.splice(MAX_EMAILS)
}

export const readMailbox = (): readonly MailboxEmail[] => emails
