import type { Email } from '../email.server.ts'
import {
  EmailAction,
  EmailLayout,
  EmailLink,
  EmailParagraph,
} from './layout.server.tsx'

// Sign-up answers an existing address as if it were new, so its owner learns
// of the attempt here
export const alreadySignedUpEmail = ({
  to,
  signInUrl,
  resetUrl,
}: {
  to: string
  signInUrl: string
  resetUrl: string
}): Email => ({
  to,
  subject: `You already have an MMMM account`,
  body: (
    <EmailLayout
      preview='Someone tried to sign up with this address'
      heading='You already have an account'
    >
      <EmailParagraph>
        Someone tried to sign up for MMMM with this email address, which already
        has an account. If it was you, sign in instead.
      </EmailParagraph>
      <EmailAction href={signInUrl}>Sign in</EmailAction>
      <EmailParagraph>
        Forgot your password? <EmailLink href={resetUrl}>Reset it</EmailLink>.
      </EmailParagraph>
      <EmailParagraph>
        If it wasn&apos;t you, ignore this email. Your account hasn&apos;t
        changed.
      </EmailParagraph>
    </EmailLayout>
  ),
})
