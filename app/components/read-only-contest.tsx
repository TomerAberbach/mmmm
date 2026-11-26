import { useId } from 'react'
import type { ReactNode } from 'react'
import { href, Link } from 'react-router'
import { LocalTime } from './local-time.tsx'
import { PageHeader } from './page-header.tsx'
import { ReportDialog } from './report-dialog.tsx'
import { ScoreCell } from './score-cell.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import type { ContestPlayer } from '~/contest-players.server.ts'
import { formatDateTime } from '~/dates.ts'
import { UNNAMED_PLAYER } from '~/leaderboard-row.ts'
import { CONTEST_TARGET } from '~/report-forms.ts'
import { describeStatus, SUBMISSION_SECTIONS } from '~/submission-status.ts'

/** A contest for someone who can't change it */
export const ReadOnlyContest = ({
  contest,
  sharedBy,
  players,
  isOpen,
  children,
}: {
  contest: { id: string; name: string; year: number }
  /** The educator whose contest it is, for a colleague who can report names */
  sharedBy: string | null
  players: ContestPlayer[]
  /** Whether the contest's year takes players and picks */
  isOpen: boolean
  children?: ReactNode
}) => (
  <div className='flex max-w-3xl flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <div className='flex flex-col gap-3'>
      <PageHeader label={`${contest.year} contest`} title={contest.name} />
      {sharedBy === null ? null : (
        <p className='text-muted'>
          {`Shared by ${sharedBy}. You can see it but not change it.`}
        </p>
      )}
    </div>
    {isOpen ? null : (
      <Link
        to={href(`/contests/:contestId/leaderboard`, { contestId: contest.id })}
        className='self-start font-semibold print:hidden'
      >
        Leaderboard
      </Link>
    )}
    {players.length === 0 ? <p className='text-muted'>No players.</p> : null}
    {SUBMISSION_SECTIONS.map(status => {
      const sectionPlayers = players.filter(player => player.status === status)
      return sectionPlayers.length > 0 ? (
        <PlayerSection
          key={status}
          title={describeStatus(status, isOpen)}
          players={sectionPlayers}
          isOpen={isOpen}
        />
      ) : null
    })}
    {children}
    {sharedBy === null ? null : (
      <ReportDialog
        action={href(`/contests/:contestId/report`, { contestId: contest.id })}
        targets={[
          CONTEST_TARGET,
          ...players
            .filter(({ displayName }) => displayName !== UNNAMED_PLAYER)
            .map(({ id, displayName }) => ({ id, label: displayName })),
        ]}
      />
    )}
  </div>
)

const PlayerSection = ({
  title,
  players,
  isOpen,
}: {
  title: string
  players: ContestPlayer[]
  isOpen: boolean
}) => {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className='flex flex-col gap-3'>
      <h2
        id={headingId}
        className={`${SECTION_HEADING_CLASS_NAME} print:break-after-avoid`}
      >
        {title}
        {` `}
        <span className='text-muted tabular-nums'>({players.length})</span>
      </h2>
      <table className='w-full table-fixed border-collapse max-sm:block'>
        <thead className='max-sm:sr-only'>
          <tr className='border-b-2 border-ink text-start font-condensed text-sm font-bold tracking-wider text-muted uppercase'>
            <th scope='col' className='px-2 py-1.5 text-start'>
              Name
            </th>
            {isOpen ? null : (
              <th scope='col' className='w-20 px-2 py-1.5 text-end'>
                Score
              </th>
            )}
            <th scope='col' className='w-60 px-2 py-1.5 text-start'>
              Started
            </th>
          </tr>
        </thead>
        <tbody className='max-sm:block max-sm:border-t-2 max-sm:border-ink'>
          {players.map(({ id, displayName, score, startedAt }) => (
            <tr
              key={id}
              className='border-b border-muted-light max-sm:relative max-sm:grid max-sm:gap-1 max-sm:py-3'
            >
              <td
                className={`px-2 py-2 font-semibold wrap-anywhere max-sm:p-0 ${isOpen ? `` : `max-sm:pe-24`}`}
              >
                {displayName}
              </td>
              {isOpen ? null : <ScoreCell score={score} />}
              <td className='px-2 py-2 text-muted tabular-nums max-sm:p-0'>
                <span className='sm:sr-only'>Started </span>
                <LocalTime date={startedAt} format={formatDateTime} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
