import type { Email } from '../email.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export type SecondFactorChange =
  | `passkey-added`
  | `passkey-removed`
  | `authenticator-app-added`
  | `authenticator-app-removed`

const SUMMARIES: Record<SecondFactorChange, string> = {
  'passkey-added': `A passkey was added`,
  'passkey-removed': `A passkey was removed`,
  'authenticator-app-added': `An authenticator app was turned on`,
  'authenticator-app-removed': `The authenticator app was turned off`,
}

export const secondFactorChangedEmail = ({
  to,
  change,
  settingsUrl,
}: {
  to: string
  change: SecondFactorChange
  settingsUrl: string
}): Email => ({
  to,
  subject: `${SUMMARIES[change]} on your MMMM account`,
  body: (
    <EmailLayout
      preview='Your second factors changed'
      heading={SUMMARIES[change]}
    >
      <EmailParagraph>
        {SUMMARIES[change]} on the MMMM account with this email address.
      </EmailParagraph>
      <EmailParagraph>
        If you didn&apos;t make this change, check your second factors and reset
        your password.
      </EmailParagraph>
      <EmailAction href={settingsUrl}>Check your second factors</EmailAction>
    </EmailLayout>
  ),
})
