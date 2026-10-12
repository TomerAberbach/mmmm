import type { Route } from './+types/home.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { SignedOutHome } from '~/components/signed-out-home.tsx'
import { readSignedInEducator } from '~/session.server.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = async ({ context }: Route.LoaderArgs) => ({
  signedIn: (await readSignedInEducator(context)) !== null,
  upcomingYear: readUpcomingYear(new Date()),
})

const Home = ({ loaderData }: Route.ComponentProps) =>
  loaderData.signedIn ? (
    <div className='flex flex-col gap-4'>
      <PageTitle>Your contests</PageTitle>
      <p>You&apos;ll create and manage contests here soon.</p>
    </div>
  ) : (
    <SignedOutHome upcomingYear={loaderData.upcomingYear} />
  )
export default Home
