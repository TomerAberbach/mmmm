import { href } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { HandOverDialog } from './hand-over-dialog.tsx'
import type { AdminContest } from '~/admin-contests.server.ts'

/** Contests, each with the button that hides it or shows it again */
export const AdminContestList = ({ contests }: { contests: AdminContest[] }) =>
  contests.length === 0 ? (
    <p className='text-muted'>No contests yet.</p>
  ) : (
    <ul className='max-w-3xl border-t-2 border-ink'>
      {contests.map(contest => (
        <li
          key={contest.id}
          className='flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-muted-light py-2'
        >
          <div className='min-w-0'>
            <p className='font-semibold wrap-anywhere'>{contest.name}</p>
            <p className='wrap-anywhere text-muted'>
              {[
                contest.isHidden ? `Hidden` : null,
                contest.year,
                contest.educatorName ?? `No educator`,
                contest.organizationName,
                `${contest.approvedCount} approved`,
              ]
                .filter(Boolean)
                .join(` · `)}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {contest.educatorName === null ? (
              <HandOverDialog contest={contest} />
            ) : null}
            <HiddenButton contest={contest} />
          </div>
        </li>
      ))}
    </ul>
  )

const HiddenButton = ({
  contest: { id, name, isHidden },
}: {
  contest: AdminContest
}) => {
  const label = isHidden ? `Show` : `Hide`
  return (
    <ConfirmDialog
      trigger={
        <Button variant='quiet' aria-label={`${label} ${name}`}>
          {label}
        </Button>
      }
      title={`${label} ${name}?`}
      confirmLabel={`${label} contest`}
      confirmVariant={isHidden ? `primary` : `danger`}
      action={href(`/admin/contests/hidden`)}
      fields={{ contestId: id, isHidden: String(!isHidden) }}
    >
      <p>
        {isHidden
          ? `Its approved brackets count on the organization and global leaderboards again.`
          : `Its brackets leave the organization and global leaderboards. Its own leaderboard stays. You can show it again.`}
      </p>
    </ConfirmDialog>
  )
}
