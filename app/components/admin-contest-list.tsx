import { href, Link } from 'react-router'
import {
  AdminContestActions,
  describeAdminContest,
} from './admin-contest-actions.tsx'
import type { AdminContest } from '~/admin-contests.server.ts'

/** Contests, each with what the admin can do with it */
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
            <Link
              to={href(`/admin/contests/:contestId`, {
                contestId: contest.id,
              })}
              className='font-semibold wrap-anywhere'
            >
              {contest.name}
            </Link>
            <p className='wrap-anywhere text-muted'>
              {describeAdminContest(contest)}
            </p>
          </div>
          <AdminContestActions contest={contest} />
        </li>
      ))}
    </ul>
  )
