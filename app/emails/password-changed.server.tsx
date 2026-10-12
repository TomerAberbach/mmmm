import type { Email } from '../email.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export const passwordChangedEmail = ({
  to,
  resetUrl,
}: {
  to: string
  resetUrl: string
}): Email => ({
  to,
  subject: `Your MMMM password was changed`,
  body: (
    <EmailLayout
      preview='Your password was changed, and other sessions were signed out'
      heading='Your password was changed'
    >
      <EmailParagraph>
        The password for the MMMM account with this email address was just
        changed, and every other signed-in browser was signed out.
      </EmailParagraph>
      <EmailParagraph>
        If you didn&apos;t change it, reset your password now.
      </EmailParagraph>
      <EmailAction href={resetUrl}>Reset password</EmailAction>
    </EmailLayout>
  ),
})
