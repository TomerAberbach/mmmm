import type { Route } from './+types/home.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { SignedOutHome } from '~/components/signed-out-home.tsx'
import { readCurrentBracketView } from '~/current-bracket.server.ts'
import { readSignedInEducator } from '~/session.server.ts'
import { readUpcomingYear } from '~/year.ts'

// The current bracket's diagram needs more room than other pages
export const handle = { fullWidth: true }

export const loader = async ({ context }: Route.LoaderArgs) => {
  if (await readSignedInEducator(context)) {
    return { signedIn: true as const }
  }
  return {
    signedIn: false as const,
    upcomingYear: readUpcomingYear(new Date()),
    current: await readCurrentBracketView(),
  }
}

const Home = ({ loaderData }: Route.ComponentProps) =>
  loaderData.signedIn ? (
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-4'>
      <PageTitle>Your contests</PageTitle>
      <p>You&apos;ll create and manage contests here soon.</p>
    </div>
  ) : (
    <SignedOutHome
      upcomingYear={loaderData.upcomingYear}
      current={loaderData.current}
    />
  )
export default Home
