import { href, redirect } from 'react-router'
import type { Route } from './+types/home.ts'
import { SignedOutHome } from '~/components/signed-out-home.tsx'
import { readCurrentBracketView } from '~/current-bracket.server.ts'
import { readSignedInEducator } from '~/session.server.ts'
import { readUpcomingYear } from '~/year.ts'

// The current bracket's diagram needs more room than other pages
export const handle = { fullWidth: true }

export const loader = async ({ context }: Route.LoaderArgs) => {
  if (await readSignedInEducator(context)) {
    throw redirect(href(`/contests`))
  }
  return {
    upcomingYear: readUpcomingYear(new Date()),
    current: await readCurrentBracketView(),
  }
}

const Home = ({ loaderData }: Route.ComponentProps) => (
  <SignedOutHome
    upcomingYear={loaderData.upcomingYear}
    current={loaderData.current}
  />
)
export default Home
