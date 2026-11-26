import { Form, href, redirect } from 'react-router'
import type { Route } from './+types/confirm-address.ts'
import {
  confirmAddressChange,
  readAddressChange,
} from '~/address-changes.server.ts'
import type { AddressConfirmation } from '~/address-changes.server.ts'
import { Button } from '~/components/button.tsx'
import { HomeLink } from '~/components/home-link.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { SupportLink } from '~/components/support-link.tsx'
import { useIsSubmitting } from '~/components/use-validated-form.ts'

export const loader = ({ params }: Route.LoaderArgs) =>
  readAddressChange(params.secret)

/** A press changes the address, since mail scanners open links */
export const action = async ({
  params,
}: Route.ActionArgs): Promise<
  Response | Exclude<AddressConfirmation, `CHANGED`>
> => {
  const confirmation = await confirmAddressChange(params.secret)
  return confirmation === `CHANGED`
    ? redirect(`${href(`/sign-in`)}?address-changed`)
    : confirmation
}

const ConfirmButton = () => (
  <Button type='submit' isPending={useIsSubmitting()}>
    Confirm email address
  </Button>
)

const ConfirmAddress = ({ loaderData, actionData }: Route.ComponentProps) => (
  <div className='flex max-w-xl flex-col items-start gap-4'>
    <meta name='robots' content='noindex' />
    <meta name='referrer' content='no-referrer' />
    {actionData === `TAKEN` ? (
      <>
        <PageTitle>This address already has an account</PageTitle>
        <p>
          Your account keeps its old address. Sign in with it, or email{` `}
          <SupportLink /> for help.
        </p>
        <HomeLink />
      </>
    ) : loaderData ? (
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
        <p>
          It expired or was already used. Email <SupportLink /> for a new one.
        </p>
        <HomeLink />
      </>
    )}
  </div>
)
export default ConfirmAddress
