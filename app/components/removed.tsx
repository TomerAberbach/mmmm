import type { ReactNode } from 'react'
import { ButtonLink } from './button.tsx'
import { LocalTime } from './local-time.tsx'
import { PageTitle } from './page-title.tsx'
import { formatLocalDate } from '~/dates.ts'
import { PLAYER_DELETION_DAYS } from '~/trash.ts'

const Removed = ({
  title,
  contestPath = null,
  children,
}: {
  title: string
  /** Where a player starts a new bracket, or null when none can start */
  contestPath?: string | null
  children?: ReactNode
}) => (
  <div className='flex max-w-xl flex-col items-start gap-4'>
    <PageTitle>{title}</PageTitle>
    {children ? <p>{children}</p> : null}
    {contestPath ? (
      <ButtonLink href={contestPath}>Start a new bracket</ButtonLink>
    ) : null}
  </div>
)

export const RemovedContest = () => (
  <Removed title='Your educator removed this contest'>
    Ask them if you think that’s a mistake.
  </Removed>
)

export const BrokenLink = () => (
  <Removed title='This link no longer works'>
    Ask your educator for a new one.
  </Removed>
)

/** What a deleted player's personal link shows. Nothing of the bracket appears */
export const DeletedBracket = ({
  restoreBy,
  contestPath,
}: {
  /** When a bracket its player deleted is erased, or null for an educator's */
  restoreBy: Date | null
  contestPath: string | null
}) =>
  restoreBy ? (
    <Removed title='This bracket was deleted' contestPath={contestPath}>
      It was deleted from its personal link. If that wasn’t you, ask your
      educator to restore it by{` `}
      <LocalTime date={restoreBy} format={formatLocalDate} />.
    </Removed>
  ) : (
    <Removed
      title='Your educator removed this bracket'
      contestPath={contestPath}
    />
  )

/** What a player sees right after deleting their own bracket */
export const DeletedOwnBracket = ({
  contestPath,
}: {
  contestPath: string | null
}) => (
  <Removed title='Your bracket is deleted' contestPath={contestPath}>
    {`If you change your mind, ask your educator to restore it within ${PLAYER_DELETION_DAYS} days.`}
  </Removed>
)
