import { Form, href, redirect } from 'react-router'
import type { Route } from './+types/confirm-address.ts'
import {
  confirmAddressChange,
  readAddressChange,
} from '~/address-changes.server.ts'
import { Button } from '~/components/button.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { useIsSubmitting } from '~/components/use-validated-form.ts'

export const loader = ({ params }: Route.LoaderArgs) =>
  readAddressChange(params.secret)

/** A press changes the address, since mail scanners open links */
export const action = async ({
  params,
}: Route.ActionArgs): Promise<Response | null> =>
  (await confirmAddressChange(params.secret))
    ? redirect(`${href(`/sign-in`)}?confirmed`)
    : null

const ConfirmButton = () => (
  <Button type='submit' isPending={useIsSubmitting()}>
    Confirm email address
  </Button>
)

const ConfirmAddress = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex max-w-xl flex-col items-start gap-4'>
    <meta name='robots' content='noindex' />
    <meta name='referrer' content='no-referrer' />
    {loaderData ? (
      <>
        <PageTitle>Confirm your email address</PageTitle>
        <p className='wrap-anywhere'>
          {`You’ll sign in with ${loaderData} and your current password. Every browser signed in to your account is signed out.`}
        </p>
        <Form method='post'>
          <ConfirmButton />
        </Form>
      </>
    ) : (
      <>
        <PageTitle>This link no longer works</PageTitle>
        <p>It expired or was already used. Email support for a new one.</p>
      </>
    )}
  </div>
)
export default ConfirmAddress
