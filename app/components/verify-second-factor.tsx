import { Form, href } from 'react-router'
import { signInWithPasskey } from '../passkeys.ts'
import { SECOND_FACTOR_EXPIRES_IN_HOURS } from '../second-factor.ts'
import { Button } from './button.tsx'
import { PageTitle } from './page-title.tsx'
import { PasskeyButton } from './passkey-button.tsx'

/**
 * For an admin whose session used no second factor lately. A passkey signs in
 * again here. An authenticator app's code is asked for only at sign-in
 */
export const VerifySecondFactor = ({ hasPasskey }: { hasPasskey: boolean }) => (
  <div className='flex max-w-md flex-col gap-6'>
    <PageTitle>Use your second factor</PageTitle>
    {hasPasskey ? (
      <>
        <p>Use your passkey to open the admin area.</p>
        <PasskeyButton ceremony={signInWithPasskey} successTo={href(`/admin`)}>
          Use your passkey
        </PasskeyButton>
      </>
    ) : (
      <>
        <p>
          The admin area asks for your second factor again every{` `}
          {SECOND_FACTOR_EXPIRES_IN_HOURS} hours. Sign out, then sign in again
          and enter the code from your app.
        </p>
        <Form method='post' action={href(`/sign-out`)}>
          <Button type='submit'>Sign out</Button>
        </Form>
      </>
    )}
  </div>
)
