import type { Email } from '../email.server.ts'
import { EmailLayout, EmailParagraph } from './layout.server.tsx'

export const addressChangedEmail = ({ to }: { to: string }): Email => ({
  to,
  subject: `Your MMMM email address was changed`,
  body: (
    <EmailLayout
      preview='Your account has a new email address'
      heading='Your email address was changed'
    >
      <EmailParagraph>
        The MMMM account with this email address now has another one, and every
        signed-in browser was signed out.
      </EmailParagraph>
      <EmailParagraph>
        If you didn’t ask for this, email support now.
      </EmailParagraph>
    </EmailLayout>
  ),
})
