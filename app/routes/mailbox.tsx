import { data } from 'react-router'
import type { Route } from './+types/mailbox.ts'
import { MailboxEmails } from '~/components/mailbox-emails.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readEmailTransport } from '~/email-settings.server.ts'
import { readMailbox } from '~/mailbox.server.ts'

// Only exists while email goes to the mailbox, in development and tests
export const loader = () => {
  if (readEmailTransport() !== `mailbox`) {
    throw data(null, { status: 404 })
  }
  return { emails: readMailbox() }
}

const Mailbox = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-4'>
    <PageTitle>Mailbox</PageTitle>
    {loaderData.emails.length === 0 ? (
      <p>No emails yet. Signing up sends one.</p>
    ) : (
      <MailboxEmails emails={loaderData.emails} />
    )}
  </div>
)
export default Mailbox
