import { Link } from 'react-router'
import { Pages } from './pages.tsx'
import { ReportDialog } from './report-dialog.tsx'
import { pluralize } from '~/format-count.ts'
import { formatRank } from '~/leaderboard-row.ts'
import type { LeaderboardPage, LeaderboardRow } from '~/leaderboard-row.ts'
import type { ReportTarget } from '~/report-forms.ts'

/**
 * Approved submissions by rank, each opening its marked bracket. The first
 * page's top rows form a podium
 */
export const Leaderboard = ({
  leaderboard: { rows, page, topScore },
  reportPath,
  toBracketPath,
}: {
  leaderboard: LeaderboardPage
  /** Null for the educator who can change the names */
  reportPath: string | null
  toBracketPath: (playerId: string) => string
}) => {
  const [firstTarget, ...otherTargets] = rows
    .filter(({ isNameRemoved }) => !isNameRemoved)
    .map(toTarget)
  const podiumRows = readPodium(rows)
  const tableRows = rows.slice(podiumRows.length)
  return rows.length > 0 ? (
    <div className='flex flex-col gap-9'>
      {podiumRows.length > 0 ? (
        <Podium rows={podiumRows} toBracketPath={toBracketPath} />
      ) : null}
      {tableRows.length > 0 ? (
        <RankTable
          rows={tableRows}
          topScore={topScore}
          toBracketPath={toBracketPath}
        />
      ) : null}
      {hasBrokenTie(rows) ? (
        <p className='text-muted'>
          Ties go to whoever finished their picks first.
        </p>
      ) : null}
      {page ? <Pages {...page} /> : null}
      {reportPath === null || !firstTarget ? null : (
        <ReportDialog
          action={reportPath}
          targets={[firstTarget, ...otherTargets]}
        />
      )}
    </div>
  ) : (
    <p className='text-muted'>No approved brackets yet.</p>
  )
}

/** Whether rows with the same score have different ranks */
const hasBrokenTie = (rows: LeaderboardRow[]): boolean =>
  rows.some(({ score, rank }, index) => {
    const above = rows[index - 1]
    return above?.score === score && above.rank !== rank
  })

/**
 * The podium's steps, by rank. Margins set the heights, so a long label
 * keeps the order
 */
const STEPS = [
  {
    step: `grow-4 basis-full bg-accent-strong text-white sm:min-h-68 sm:basis-0`,
    rank: `text-8xl sm:text-9xl`,
    score: `text-5xl`,
    name: `text-3xl`,
  },
  {
    step: `grow-3 basis-0 bg-accent-soft sm:mt-14`,
    rank: `text-6xl md:text-8xl`,
    score: `text-3xl sm:text-4xl`,
    name: `text-xl sm:text-2xl`,
  },
  {
    step: `grow-3 basis-0 bg-white sm:mt-26`,
    rank: `text-6xl`,
    score: `text-3xl sm:text-4xl`,
    name: `text-xl sm:text-2xl`,
  },
] as const

/**
 * The top rows with points, without splitting players who share a rank. Empty
 * for a later page's rows
 */
const readPodium = (rows: LeaderboardRow[]): LeaderboardRow[] => {
  const topRows = rows.filter(({ rank }) => rank <= STEPS.length)
  const splitRank = topRows[STEPS.length]?.rank
  return topRows.filter(({ rank, score }) => rank !== splitRank && score > 0)
}

type RowsProps = {
  rows: LeaderboardRow[]
  toBracketPath: (playerId: string) => string
}

const Podium = ({ rows, toBracketPath }: RowsProps) => (
  // Safari drops an unstyled list's semantics without the role
  // eslint-disable-next-line jsx-a11y/no-redundant-roles
  <ol
    role='list'
    aria-label='Top of the leaderboard'
    className='me-2 mb-2 flex max-w-3xl flex-wrap border-2 border-ink shadow-offset sm:me-0 sm:mb-0 sm:flex-nowrap sm:border-0 sm:border-b-8 sm:shadow-none'
  >
    {rows.map(row => (
      <PodiumStep
        key={row.playerId}
        row={row}
        bracketPath={toBracketPath(row.playerId)}
      />
    ))}
  </ol>
)

const PodiumStep = ({
  row: { label, score, rank, isOwn },
  bracketPath,
}: {
  row: LeaderboardRow
  bracketPath: string
}) => {
  const classNames = STEPS[rank - 1]!
  return (
    <li
      className={`flex min-w-0 break-inside-avoid flex-col justify-between gap-4 border-2 border-ink p-4 sm:border-4 sm:px-5 sm:not-first:border-s-0 print:bg-white print:text-black ${classNames.step}`}
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <span
          className={`font-display leading-none tabular-nums ${classNames.rank}`}
        >
          <span className='sr-only'>Rank </span>
          {rank}
        </span>
        {` `}
        <span className='text-end'>
          <span
            className={`block font-display leading-none tabular-nums ${classNames.score}`}
          >
            {score}
          </span>
          {` `}
          <span className='font-condensed font-bold tracking-wider uppercase'>
            {pluralize(score, `point`)}
          </span>
        </span>
      </div>
      {` `}
      <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
        <Link
          to={bracketPath}
          className={`min-w-0 font-condensed leading-tight font-extrabold wrap-anywhere text-inherit uppercase underline-offset-4 print:no-underline ${classNames.name}`}
        >
          {label}
        </Link>
        {isOwn ? <YouTag className='bg-ink text-white' /> : null}
      </div>
    </li>
  )
}

const RankTable = ({
  rows,
  topScore,
  toBracketPath,
}: RowsProps & { topScore: number }) => (
  <table className='w-full max-w-3xl border-collapse tabular-nums'>
    <thead>
      <tr className='font-condensed font-bold tracking-wider text-muted uppercase'>
        <th scope='col' className='w-12 px-2 py-1.5 text-end sm:w-16 sm:pe-4'>
          Rank
        </th>
        <th scope='col' className='px-2 py-1.5 text-start'>
          Player
        </th>
        <th scope='col' className='w-16 px-2 py-1.5 text-end sm:w-24 sm:pe-4'>
          Score
        </th>
      </tr>
    </thead>
    <tbody>
      {rows.map(({ playerId, label, score, rank, isOwn }) => (
        <tr
          key={playerId}
          className={`break-inside-avoid border-t-2 border-ink ${isOwn ? `bg-ink text-white print:bg-transparent print:text-black` : ``}`}
        >
          <td className='px-2 py-3 text-end font-display text-2xl sm:pe-4 sm:text-3xl'>
            {rank}
          </td>
          <td className='px-2 py-3'>
            <span className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
              <Link
                to={toBracketPath(playerId)}
                className='min-w-0 text-lg font-semibold wrap-anywhere text-inherit print:no-underline'
              >
                {label}
              </Link>
              {isOwn ? <YouTag className='bg-accent-soft text-ink' /> : null}
            </span>
            <ScoreBar score={score} topScore={topScore} isOwn={isOwn} />
          </td>
          <td className='px-2 py-3 text-end font-display text-2xl sm:pe-4 sm:text-3xl'>
            {score}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)

/** The score's share of the top score. The row also has the score as text */
const ScoreBar = ({
  score,
  topScore,
  isOwn,
}: {
  score: number
  topScore: number
  isOwn: boolean
}) => (
  <span
    aria-hidden
    className={`mt-2 block h-2.5 print:hidden ${isOwn ? `bg-muted` : `bg-accent-soft/20`}`}
  >
    <span
      className={`block h-full ${isOwn ? `bg-accent-soft` : `bg-accent`}`}
      style={{ width: topScore > 0 ? `${(100 * score) / topScore}%` : 0 }}
    />
  </span>
)

const YouTag = ({ className }: { className: string }) => (
  <>
    {` `}
    <span
      className={`px-2.5 font-condensed font-extrabold tracking-wider uppercase print:border print:border-black print:bg-transparent print:text-black ${className}`}
    >
      You
    </span>
  </>
)

const toTarget = ({ playerId, rank, label }: LeaderboardRow): ReportTarget => ({
  id: playerId,
  label: `${formatRank(rank)} · ${label}`,
})
