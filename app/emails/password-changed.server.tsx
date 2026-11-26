import { href } from 'react-router'
import type { Email } from '../email.server.ts'
import { toAppUrl } from '../env.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export const passwordChangedEmail = ({ to }: { to: string }): Email => ({
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
        If you didn’t change it, reset your password now.
      </EmailParagraph>
      <EmailAction href={toAppUrl(href(`/forgot-password`)).href}>
        Reset password
      </EmailAction>
    </EmailLayout>
  ),
})
