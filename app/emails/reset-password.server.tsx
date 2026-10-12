import { RESET_EXPIRES_IN_HOURS } from '../auth-forms.ts'
import type { Email } from '../email.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export const resetPasswordEmail = ({
  to,
  url,
}: {
  to: string
  url: string
}): Email => ({
  to,
  subject: `Reset your MMMM password`,
  body: (
    <EmailLayout
      preview='Set a new password for your MMMM account'
      heading='Reset your password'
    >
      <EmailParagraph>
        Someone asked to reset the password for the MMMM account with this email
        address. If it was you, set a new password.
      </EmailParagraph>
      <EmailAction href={url}>Set a new password</EmailAction>
      <EmailParagraph>
        The link works once and expires in {RESET_EXPIRES_IN_HOURS} hour. If you
        didn&apos;t ask, ignore this email. Your password hasn&apos;t changed.
      </EmailParagraph>
    </EmailLayout>
  ),
})
