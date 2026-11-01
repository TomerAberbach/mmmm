import { data } from 'react-router'
import type { Route } from './+types/contests.$contestId.ts'
import { ContestDetails } from '~/components/contest-details.tsx'
import { readEducatorContest } from '~/contests.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

// Another educator's contest gets the not-found page, so its ID reveals nothing
export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const contest = await readEducatorContest(
    readRequiredEducator(context).id,
    params.contestId,
  )
  if (!contest) {
    throw data(null, { status: 404 })
  }
  return contest
}

const ContestPage = ({ loaderData }: Route.ComponentProps) => (
  <ContestDetails contest={loaderData} />
)
export default ContestPage
