import { href, Link } from 'react-router'
import { LocalTime } from './local-time.tsx'
import { TrashList } from './trash-list.tsx'
import type { Contest } from '~/contests.server.ts'
import { formatDateTime, formatLocalDate } from '~/dates.ts'
import { describeStatus } from '~/submission-status.ts'
import type { DeletedPlayer } from '~/trash.server.ts'
import { readEraseTime } from '~/trash.ts'

export const ContestTrash = ({
  contest: { id: contestId, name },
  players,
  isOpen,
}: {
  contest: Contest
  players: DeletedPlayer[]
  /** Whether the contest's year takes players and picks */
  isOpen: boolean
}) => (
  <div className='flex max-w-3xl flex-col gap-6'>
    <Link
      to={href(`/contests/:contestId`, { contestId })}
      className='self-start print:hidden'
    >
      {name}
    </Link>
    <TrashList
      title='Trash'
      noun='bracket'
      items={players.map(player => ({
        id: player.id,
        name: player.displayName,
        detail: describeStatus(player.status, isOpen),
        deletion: <Deletion player={player} />,
      }))}
      restorePath={href(`/contests/:contestId/trash/restore`, { contestId })}
      erasePath={href(`/contests/:contestId/trash/erase`, { contestId })}
      eraseTitle={item => `Delete ${item.name}’s bracket forever?`}
    >
      You can restore these until next year’s bracket is published, unless a row
      says sooner.
    </TrashList>
  </div>
)

const Deletion = ({ player }: { player: DeletedPlayer }) => {
  const eraseTime = readEraseTime(player)
  return (
    <>
      {player.deletedBy === `PLAYER`
        ? `Deleted by player, `
        : `Deleted by you, `}
      <LocalTime date={player.deletedAt} format={formatDateTime} />
      {eraseTime ? (
        <>
          . Erased for good{` `}
          <LocalTime date={eraseTime} format={formatLocalDate} />
        </>
      ) : null}
    </>
  )
}
