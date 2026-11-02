import { Link, useFetcher } from 'react-router'
import { CONFIRMATION_EXPIRES_IN_DAYS } from '../auth-forms.ts'
import { formatTime } from '../dates.ts'
import { Button } from './button.tsx'
import { Notice } from './notice.tsx'
import { PageTitle } from './page-title.tsx'

export type ResendResult = { sentAt: Date } | { error: string }

export const CheckEmail = ({
  email,
  reason,
}: {
  email: string
  // `unconfirmed` points to the link sent at sign-up instead of a new one
  reason: `signed-up` | `unconfirmed`
}) => {
  const resend = useFetcher<ResendResult>()
  const address = <strong className='break-all'>{email}</strong>
  return (
    <div className='flex max-w-xl flex-col gap-4'>
      <PageTitle>Check your email</PageTitle>
      {reason === `signed-up` ? (
        <p>
          We sent a link to {address}. Open it to confirm your address. It
          expires in {CONFIRMATION_EXPIRES_IN_DAYS} days.
        </p>
      ) : (
        <p>
          Confirm your address before you sign in. Open the link we sent to{` `}
          {address} when you signed up. Each link expires in{` `}
          {CONFIRMATION_EXPIRES_IN_DAYS} days.
        </p>
      )}
      <p>Can&apos;t find it? Check your spam folder, or send it again.</p>
      <resend.Form
        method='post'
        action='/resend-confirmation'
        className='flex flex-wrap items-center gap-4'
      >
        <input type='hidden' name='email' value={email} />
        <Button
          type='submit'
          variant='secondary'
          isPending={resend.state !== `idle`}
        >
          Resend email
        </Button>
        {resend.data && `sentAt` in resend.data ? (
          <output>
            Sent again at{` `}
            {formatTime(resend.data.sentAt)}
          </output>
        ) : null}
        {resend.data && `error` in resend.data ? (
          <Notice kind='alert'>{resend.data.error}</Notice>
        ) : null}
      </resend.Form>
      <p>
        Wrong address? <Link to='/sign-up'>Sign up again</Link> with the right
        one.
      </p>
    </div>
  )
}
