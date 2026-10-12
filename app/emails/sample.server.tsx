import { requireEnv } from '../env.server.ts'
import { EmailAction, EmailLayout, EmailParagraph } from './layout.server.tsx'

export const sampleEmail = (to: string) => ({
  to,
  subject: `Test email from MMMM`,
  body: <SampleEmail />,
})

const SampleEmail = () => (
  <EmailLayout preview='If you can read this, email works' heading='Test email'>
    <EmailParagraph>
      This is a test email from MMMM. If you can read it, sending works.
    </EmailParagraph>
    <EmailAction href={requireEnv(`BETTER_AUTH_URL`)}>Open MMMM</EmailAction>
  </EmailLayout>
)
