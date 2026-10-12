import { CONFIRMATION_EXPIRES_IN_DAYS } from '../auth-forms.ts'
import type { Email } from '../email.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

// Greets no one by name, because whoever signed up chose the name and may not
// own the address
export const confirmEmail = ({
  to,
  url,
}: {
  to: string
  url: string
}): Email => ({
  to,
  subject: `Confirm your email address for MMMM`,
  body: (
    <EmailLayout
      preview='Confirm your address to start running contests'
      heading='Confirm your email address'
    >
      <EmailParagraph>
        Someone signed up for MMMM with this email address. If it was you,
        confirm it, then sign in to start running contests.
      </EmailParagraph>
      <EmailAction href={url}>Confirm email address</EmailAction>
      <EmailParagraph>
        The link expires in {CONFIRMATION_EXPIRES_IN_DAYS} days. If you
        didn&apos;t sign up, ignore this email.
      </EmailParagraph>
    </EmailLayout>
  ),
})
