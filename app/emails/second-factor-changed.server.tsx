import { href } from 'react-router'
import type { Email } from '../email.server.ts'
import { toAppUrl } from '../env.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export type SecondFactorChange =
  | `passkey-added`
  | `passkey-removed`
  | `authenticator-app-added`
  | `authenticator-app-removed`

/** Each goes before the account */
const SUMMARIES: Record<SecondFactorChange, string> = {
  'passkey-added': `A passkey was added to`,
  'passkey-removed': `A passkey was removed from`,
  'authenticator-app-added': `An authenticator app was turned on for`,
  'authenticator-app-removed': `The authenticator app was turned off for`,
}

export const secondFactorChangedEmail = ({
  to,
  change,
}: {
  to: string
  change: SecondFactorChange
}): Email => ({
  to,
  subject: `${SUMMARIES[change]} your MMMM account`,
  body: (
    <EmailLayout
      preview='Your second factors changed'
      heading={`${SUMMARIES[change]} your account`}
    >
      <EmailParagraph>
        {SUMMARIES[change]} the MMMM account with this email address.
      </EmailParagraph>
      <EmailParagraph>
        If you didn’t make this change, check your second factors and reset your
        password.
      </EmailParagraph>
      <EmailAction href={toAppUrl(href(`/settings`)).href}>
        Check your second factors
      </EmailAction>
    </EmailLayout>
  ),
})
