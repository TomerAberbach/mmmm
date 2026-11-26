import { Link } from 'react-router'
import { MarkedBracket } from './marked-bracket.tsx'
import { PageTitle } from './page-title.tsx'
import { formatRank } from '~/leaderboard-row.ts'
import type { LeaderboardSubmission } from '~/leaderboards.server.ts'

/** The marked bracket that a leaderboard's row opens */
export const LeaderboardBracket = ({
  submission: {
    row: { label, rank },
    ...marked
  },
  contest,
  leaderboardPath,
}: {
  submission: LeaderboardSubmission
  contest: { name: string; year: number }
  leaderboardPath: string
}) => (
  <div className='flex flex-col gap-6'>
    <Link to={leaderboardPath} className='self-start print:hidden'>
      Leaderboard
    </Link>
    <PageTitle>{`${label}’s bracket`}</PageTitle>
    <p className='text-lg'>
      <strong>{formatRank(rank)}</strong>
      {` in ${contest.name}`}
    </p>
    <MarkedBracket year={contest.year} {...marked} />
  </div>
)
