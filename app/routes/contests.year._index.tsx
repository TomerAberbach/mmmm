import type { Route } from './+types/contests.year._index.ts'
import { buildBracketView } from '~/bracket-view.ts'
import { readBracketAndResults } from '~/brackets.server.ts'
import { Bracket } from '~/components/bracket.tsx'
import { LeaderboardLinks } from '~/components/leaderboard-links.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readOrganization } from '~/organizations.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'
import { toSeededBracket } from '~/seeded-bracket.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { isOpenYear } from '~/years.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const year = await readRequiredYear(params.year)
  const [{ bracket, results }, organization, isOpen] = await Promise.all([
    readBracketAndResults(year),
    readOrganization(readRequiredEducator(context).id),
    isOpenYear(year),
  ])
  return {
    view: buildBracketView(year, toSeededBracket(bracket), results),
    hasOrganization: organization !== null,
    isOpen,
  }
}

const YearPage = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6 page-landscape'>
    <PageTitle>{`${loaderData.view.year} bracket`}</PageTitle>
    {loaderData.isOpen ? null : (
      <LeaderboardLinks
        year={loaderData.view.year}
        hasOrganization={loaderData.hasOrganization}
      />
    )}
    <Bracket view={loaderData.view} />
  </div>
)
export default YearPage
