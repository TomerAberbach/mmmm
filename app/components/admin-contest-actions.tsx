import { href } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { HandOverDialog } from './hand-over-dialog.tsx'
import type { AdminContest } from '~/admin-contests.server.ts'

/** Such as "Hidden · 2027 · Ms. Frizzle · 24 approved" */
export const describeAdminContest = (contest: AdminContest): string =>
  [
    contest.isInTrash ? `In the trash` : null,
    contest.isHidden ? `Hidden` : null,
    contest.year,
    contest.educatorName ?? `No educator`,
    contest.organizationName,
    `${contest.approvedCount} approved`,
  ]
    .filter(Boolean)
    .join(` · `)

/**
 * Hide or Show, outside the trash, and Hand over for an orphaned contest, even
 * in the trash
 */
export const AdminContestActions = ({ contest }: { contest: AdminContest }) => (
  <div className='flex flex-wrap gap-2'>
    {contest.educatorName === null ? (
      <HandOverDialog contest={contest} />
    ) : null}
    {contest.isInTrash ? null : <HiddenButton contest={contest} />}
  </div>
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
