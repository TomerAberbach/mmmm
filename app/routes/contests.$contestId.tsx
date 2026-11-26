import { href, Link } from 'react-router'
import type { Route } from './+types/contests.$contestId.ts'
import { ContestDetails } from '~/components/contest-details.tsx'
import { ContestShares } from '~/components/contest-shares.tsx'
import { ReadOnlyContest } from '~/components/read-only-contest.tsx'
import { readViewableContest } from '~/contest-context.server.ts'
import { readContestPlayers } from '~/contest-players.server.ts'
import { areNamesRemoved } from '~/name-removal.server.ts'
import { readContestOrganization } from '~/organizations.server.ts'
import { readPastYear } from '~/past-years.server.ts'
import { readColleagues } from '~/shares.server.ts'
import type { Colleague } from '~/shares.server.ts'
import { countDeletedPlayers } from '~/trash.server.ts'
import { isOpenYear } from '~/years.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { access, contest } = readViewableContest(context)
  const [isOpen, pastYear] = await Promise.all([
    isOpenYear(contest.year),
    readPastYear(contest.year),
  ])
  const players = await readContestPlayers(
    contest.id,
    isOpen ? `OLDEST_FIRST` : `HIGHEST_SCORE_FIRST`,
  )
  if (access === `shared`) {
    return {
      view: `shared`,
      contest,
      sharedBy: contest.educatorName,
      isOpen,
      players,
      areNamesRemoved: areNamesRemoved(contest.year, new Date()),
    } as const
  }
  const [deletedCount, organization, colleagues] = await Promise.all([
    countDeletedPlayers(contest.id),
    readContestOrganization(contest.id),
    readColleagues(contest.id),
  ])
  return {
    view: pastYear ? `past` : `own`,
    contest,
    isOpen,
    players,
    deletedCount,
    colleagues: organization && colleagues,
  } as const
}

const ContestPage = ({ loaderData }: Route.ComponentProps) => {
  switch (loaderData.view) {
    case `own`:
      return <ContestDetails {...loaderData} />
    case `shared`:
      return <ReadOnlyContest {...loaderData} />
    case `past`:
      return (
        <ReadOnlyContest
          {...loaderData}
          sharedBy={null}
          areNamesRemoved={false}
        >
          <PastContestControls {...loaderData} />
        </ReadOnlyContest>
      )
  }
}
export default ContestPage

/** What an educator can still do, while there's something to do it to */
const PastContestControls = ({
  contest,
  deletedCount,
  colleagues,
}: {
  contest: { id: string; name: string }
  deletedCount: number
  colleagues: Colleague[] | null
}) => (
  <>
    {colleagues ? (
      <ContestShares
        key={contest.id}
        contest={contest}
        colleagues={colleagues}
        isPast
      />
    ) : null}
    {deletedCount > 0 ? (
      <Link
        to={href(`/contests/:contestId/trash`, { contestId: contest.id })}
        className='self-start print:hidden'
      >
        {`Trash (${deletedCount})`}
      </Link>
    ) : null}
  </>
)
