import type { Email } from '../email.server.ts'
import { SETUP_LINK_EXPIRES_IN_HOURS } from '../second-factor.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export const secondFactorSetupEmail = ({
  to,
  url,
}: {
  to: string
  url: string
}): Email => ({
  to,
  subject: `Set up your MMMM second factor`,
  body: (
    <EmailLayout
      preview='Add a passkey or authenticator app to open the admin area'
      heading='Set up your second factor'
    >
      <EmailParagraph>
        Someone signed in to the MMMM admin account with this email address and
        asked to set up a second factor. If it was you, open this link in the
        browser where you&apos;re signed in.
      </EmailParagraph>
      <EmailAction href={url}>Set up a second factor</EmailAction>
      <EmailParagraph>
        The link works once and expires in {SETUP_LINK_EXPIRES_IN_HOURS} hour.
        If you didn&apos;t ask, someone may know your password, so reset it.
      </EmailParagraph>
    </EmailLayout>
  ),
})
