import { PageTitle } from '~/components/page-title.tsx'

export const meta = () => [{ title: `Privacy policy` }]

const Privacy = () => (
  <div className='flex max-w-prose flex-col gap-4'>
    <PageTitle>Privacy policy</PageTitle>
    <p>The privacy policy will be published here before the app launches.</p>
  </div>
)
export default Privacy
