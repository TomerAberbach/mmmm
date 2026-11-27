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
  year,
  scopeName,
  leaderboardPath,
}: {
  submission: LeaderboardSubmission
  year: number
  /** What the rank is in, such as a contest's name */
  scopeName: string
  leaderboardPath: string
}) => (
  <div className='flex flex-col gap-6'>
    <Link to={leaderboardPath} className='self-start print:hidden'>
      Leaderboard
    </Link>
    <PageTitle>{toTitle(label)}</PageTitle>
    <p className='text-lg'>
      <strong>{formatRank(rank)}</strong>
      {` · ${scopeName}`}
    </p>
    <MarkedBracket year={year} {...marked} />
  </div>
)

/** A label such as "Player from Period 2 (Ms. Frizzle)" takes no possessive */
const toTitle = (label: string): string =>
  label.startsWith(`Player from `)
    ? `Bracket of a p${label.slice(1)}`
    : `${label}’s bracket`
