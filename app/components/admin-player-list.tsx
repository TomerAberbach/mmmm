import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import type { AdminPlayer } from '~/admin-contests.server.ts'

/** A contest's players, each with the button that erases them */
export const AdminPlayerList = ({
  players,
  action,
}: {
  players: AdminPlayer[]
  /** The route action that erases a player */
  action: string
}) =>
  players.length === 0 ? (
    <p className='text-muted'>No players yet.</p>
  ) : (
    <ul className='max-w-3xl border-t-2 border-ink'>
      {players.map(({ id, displayName, isInTrash }) => (
        <li
          key={id}
          className='flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-muted-light py-2'
        >
          <div className='min-w-0'>
            <p className='font-semibold wrap-anywhere'>{displayName}</p>
            {isInTrash ? <p className='text-muted'>In the trash</p> : null}
          </div>
          <ConfirmDialog
            trigger={
              <Button variant='quiet' aria-label={`Erase ${displayName}`}>
                Erase
              </Button>
            }
            title={`Erase ${displayName}?`}
            confirmLabel='Erase player'
            action={action}
            fields={{ playerId: id }}
          >
            <p>
              Their bracket and score leave every leaderboard, and their
              personal link stops working. This can’t be undone, though backups
              keep the data for up to 30 days.
            </p>
          </ConfirmDialog>
        </li>
      ))}
    </ul>
  )
