import { href } from 'react-router'
import { CONFIRMATION_EXPIRES_IN_DAYS } from '../auth-forms.ts'
import type { Email } from '../email.server.ts'
import { toAppUrl } from '../env.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export const launchEmail = ({
  to,
  url,
}: {
  to: string
  url: string
}): Email => ({
  to,
  subject: `Set your password for the new MMMM`,
  body: (
    <EmailLayout
      preview='Your account moved to the new MMMM'
      heading='MMMM is new this year'
    >
      <EmailParagraph>
        March Mammal Madness Manager has been rebuilt, and your account and any
        past contests moved with it. Set a new password to sign in. It also
        confirms your email address.
      </EmailParagraph>
      <EmailAction href={url}>Set a password</EmailAction>
      <EmailParagraph>
        The link works once and expires in {CONFIRMATION_EXPIRES_IN_DAYS} days.
        After that, use Forgot password with this address:{` `}
        {toAppUrl(href(`/forgot-password`)).href}
      </EmailParagraph>
    </EmailLayout>
  ),
})
