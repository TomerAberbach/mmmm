import { CONFIRMATION_EXPIRES_IN_DAYS } from '../auth-forms.ts'
import type { Email } from '../email.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

/** Greets no one by name, because the address may not be the educator's */
export const confirmAddressEmail = ({
  to,
  url,
}: {
  to: string
  url: string
}): Email => ({
  to,
  subject: `Confirm your new email address for MMMM`,
  body: (
    <EmailLayout
      preview='Confirm the address to sign in with it'
      heading='Confirm your new email address'
    >
      <EmailParagraph>
        MMMM support was asked to change an account’s email address to this one.
        If that’s your account, confirm the address, then sign in with it and
        your current password.
      </EmailParagraph>
      <EmailAction href={url}>Confirm email address</EmailAction>
      <EmailParagraph>
        The link expires in {CONFIRMATION_EXPIRES_IN_DAYS} days. If you didn’t
        ask for this, ignore this email.
      </EmailParagraph>
    </EmailLayout>
  ),
})
