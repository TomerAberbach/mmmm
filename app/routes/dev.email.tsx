import { Input, Label, TextField } from 'react-aria-components'
import { data, Form, Link, useNavigation } from 'react-router'
import type { Route } from './+types/dev.email.ts'
import { Button } from '~/components/button.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readEmailTransport } from '~/email-settings.server.ts'
import { sendEmail } from '~/email.server.ts'
import { sampleEmail } from '~/emails/sample.server.tsx'

// Staging can send one too, to check real delivery through Resend
const requireEmailTesting = () => {
  if (!import.meta.env.DEV && process.env.APP_ENV !== `staging`) {
    throw data(null, { status: 404 })
  }
}

export const loader = () => {
  requireEmailTesting()
  return { transport: readEmailTransport() }
}

export const action = async ({ request }: Route.ActionArgs) => {
  requireEmailTesting()
  const to = (await request.formData()).get(`to`)
  if (typeof to !== `string` || !to.includes(`@`)) {
    return { error: `Enter an email address` }
  }
  try {
    await sendEmail(sampleEmail(to))
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  return { sentTo: to }
}

const DevEmail = ({ loaderData, actionData }: Route.ComponentProps) => {
  const isSending = useNavigation().state === `submitting`
  return (
    <div className='flex max-w-prose flex-col gap-4'>
      <PageTitle>Sample email</PageTitle>
      <Form method='post' className='flex flex-col items-start gap-4'>
        <TextField
          name='to'
          type='email'
          isRequired
          className='flex flex-col gap-1'
        >
          <Label className='font-semibold'>Send to</Label>
          <Input className='min-h-11 w-80 max-w-full border-2 border-ink px-3' />
        </TextField>
        <Button type='submit' isPending={isSending}>
          Send sample email
        </Button>
      </Form>
      {actionData && `error` in actionData ? (
        <p role='alert' className='font-semibold text-danger'>
          {actionData.error}
        </p>
      ) : null}
      {actionData && `sentTo` in actionData ? (
        <output>
          Sent to {actionData.sentTo}.{` `}
          {loaderData.transport === `mailbox` ? (
            <Link to='/dev/mailbox'>Open the mailbox</Link>
          ) : null}
        </output>
      ) : null}
    </div>
  )
}
export default DevEmail
