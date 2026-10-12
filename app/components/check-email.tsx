import { Link, useFetcher } from 'react-router'
import { CONFIRMATION_EXPIRES_IN_DAYS } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { PageTitle } from './page-title.tsx'

export type ResendResult = { sentAt: Date }

export const CheckEmail = ({ email }: { email: string }) => {
  const resend = useFetcher<ResendResult>()
  return (
    <div className='flex max-w-xl flex-col gap-4'>
      <PageTitle>Check your email</PageTitle>
      <p>
        We sent a link to <strong className='break-all'>{email}</strong>. Open
        it to confirm your address. It expires in {CONFIRMATION_EXPIRES_IN_DAYS}
        {` `}
        days.
      </p>
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
        {resend.data ? (
          <output>
            Sent again at{` `}
            {resend.data.sentAt.toLocaleTimeString([], {
              hour: `numeric`,
              minute: `2-digit`,
            })}
          </output>
        ) : null}
      </resend.Form>
      <p>
        Wrong address? <Link to='/sign-up'>Sign up again</Link> with the right
        one.
      </p>
    </div>
  )
}
