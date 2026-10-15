import type { ReactNode } from 'react'
import { Form, useNavigation } from 'react-router'
import { addPasskey } from '../passkeys.ts'
import { SETUP_LINK_EXPIRES_IN_HOURS } from '../second-factor.ts'
import { Button, ButtonLink } from './button.tsx'
import { Notice } from './notice.tsx'
import { PageTitle } from './page-title.tsx'
import { PasskeyButton } from './passkey-button.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'

const WHY = `Admins sign in with a second step, so a stolen password alone can't change results.`

// Setting up the first second factor starts with an emailed link, so a stolen
// password alone can't add one
export const SetupLinkRequest = ({
  email,
  linkInvalid,
  isSent,
}: {
  email: string
  // Whether the page opened from a link that expired or was used
  linkInvalid: boolean
  isSent: boolean
}) => {
  const isSubmitting = useNavigation().state === `submitting`
  // A new submission hides the last one's result until it answers
  const state =
    isSent && !isSubmitting ? `sent` : linkInvalid ? `link-invalid` : `unsent`
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Set up a second factor</PageTitle>
      <p>{WHY}</p>
      <p>
        First, we&apos;ll email a setup link to{` `}
        <strong className='break-all'>{email}</strong>, so we know it&apos;s
        you. Open it in this browser.
      </p>
      {state === `link-invalid` ? (
        <Notice kind='alert'>
          That setup link has expired or was already used. Email yourself a new
          one.
        </Notice>
      ) : null}
      <Form method='post' className='flex flex-col gap-5'>
        <div>
          <Button
            type='submit'
            variant={state === `sent` ? `secondary` : `primary`}
            isPending={isSubmitting}
          >
            {state === `sent` ? `Send again` : `Email me a setup link`}
          </Button>
        </div>
        {state === `sent` ? (
          <Notice kind='status'>
            We emailed you a setup link. It expires in{` `}
            {SETUP_LINK_EXPIRES_IN_HOURS} hour.
          </Notice>
        ) : null}
      </Form>
    </div>
  )
}

export const SecondFactorChoice = () => (
  <div className='flex max-w-md flex-col gap-6'>
    <PageTitle>Set up a second factor</PageTitle>
    <p>{WHY} Choose one way to do it.</p>
    <SetupOption
      title='Passkey'
      isRecommended
      description="Use your fingerprint, face, or device PIN. It can't be phished, and you can sign in with it instead of your password."
    >
      <PasskeyButton ceremony={addPasskey} successTo='/admin'>
        Add a passkey
      </PasskeyButton>
    </SetupOption>
    <SetupOption
      title='Authenticator app'
      description='Enter a 6-digit code from an app such as 1Password, Google Authenticator, or Authy each time you sign in.'
    >
      <div>
        <ButtonLink href='/admin/setup/authenticator-app' variant='secondary'>
          Use an authenticator app
        </ButtonLink>
      </div>
    </SetupOption>
  </div>
)

const SetupOption = ({
  title,
  isRecommended = false,
  description,
  children,
}: {
  title: string
  isRecommended?: boolean
  description: string
  children: ReactNode
}) => (
  <section className='flex flex-col gap-3 border-2 border-ink p-4'>
    {isRecommended ? (
      <p className='font-condensed text-sm font-bold tracking-wide text-accent-strong uppercase'>
        Recommended
      </p>
    ) : null}
    <h2 className={SECTION_HEADING_CLASS_NAME}>{title}</h2>
    <p className='text-muted'>{description}</p>
    {children}
  </section>
)
