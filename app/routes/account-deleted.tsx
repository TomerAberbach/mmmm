import { PageTitle } from '~/components/page-title.tsx'

const AccountDeleted = () => (
  <div className='flex max-w-xl flex-col gap-4'>
    <PageTitle>Your account is deleted</PageTitle>
    <p>
      Your players keep their personal links. You can sign up again at any time
      with an empty account.
    </p>
  </div>
)
export default AccountDeleted
