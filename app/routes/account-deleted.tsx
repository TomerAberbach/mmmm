import { href, redirect } from 'react-router'
import type { Route } from './+types/account-deleted.ts'
import { HomeLink } from '~/components/home-link.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readSignedInEducator } from '~/session.server.ts'

/** A signed-in educator's account isn't deleted */
export const loader = async ({ context }: Route.LoaderArgs) =>
  (await readSignedInEducator(context)) ? redirect(href(`/contests`)) : null

const AccountDeleted = () => (
  <div className='flex max-w-xl flex-col gap-4'>
    <PageTitle>Your account is deleted</PageTitle>
    <p>
      Your players keep their personal links. You can sign up again at any time
      with an empty account.
    </p>
    <HomeLink />
  </div>
)
export default AccountDeleted
