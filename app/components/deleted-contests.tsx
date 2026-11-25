import { href, Link } from 'react-router'
import { LocalTime } from './local-time.tsx'
import { TrashList } from './trash-list.tsx'
import { formatDateTime } from '~/dates.ts'
import { formatCount } from '~/format-count.ts'
import type { DeletedContest } from '~/trash.server.ts'

export const DeletedContests = ({
  contests,
}: {
  contests: DeletedContest[]
}) => (
  <div className='flex max-w-3xl flex-col gap-6'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      Your contests
    </Link>
    <TrashList
      title='Deleted contests'
      noun='contest'
      items={contests.map(contest => ({
        id: contest.id,
        name: contest.name,
        detail: `${formatCount(contest.submissionCount, `submission`)}, ${formatCount(contest.draftCount, `draft`)}`,
        deletion: (
          <>
            Deleted{` `}
            <LocalTime date={contest.deletedAt} format={formatDateTime} />
          </>
        ),
      }))}
      restorePath={href(`/contests/trash/restore`)}
      erasePath={href(`/contests/trash/erase`)}
      eraseTitle={item => `Delete ${item.name} and its brackets forever?`}
    >
      You can restore these until next year’s bracket is published. A contest’s
      brackets come back with it.
    </TrashList>
  </div>
)
