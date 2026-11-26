import type { ReactNode } from 'react'
import { ButtonLink } from './button.tsx'
import { LocalTime } from './local-time.tsx'
import { PageTitle } from './page-title.tsx'
import { formatLocalDate } from '~/dates.ts'
import { OR_BEFORE_ARCHIVE, PLAYER_DELETION_DAYS } from '~/trash.ts'

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

/** Follows a link that a deletion turned off once no educator can restore it */
const CANNOT_RESTORE = `Your educator left MMMM, so they can’t restore it.`

const ASK_ABOUT_MISTAKE = `Ask them if you think that’s a mistake.`

export const RemovedContest = ({
  isOrphaned,
}: {
  /** Whether the contest has no educator */
  isOrphaned: boolean
}) => (
  <Removed title='Your educator deleted this contest'>
    {isOrphaned ? CANNOT_RESTORE : ASK_ABOUT_MISTAKE}
  </Removed>
)

export const BrokenLink = () => (
  <Removed title='This link doesn’t work'>
    Ask your educator for a new one.
  </Removed>
)

const CANNOT_START = `This contest takes no new players, so you can’t start a new bracket.`

/** What a deleted player's personal link shows. Nothing of the bracket appears */
export const DeletedBracket = ({
  restoreBy,
  contestPath,
  isOpen,
  isPast,
  isOrphaned,
}: {
  /** When a bracket its player deleted is erased, or null for an educator's */
  restoreBy: Date | null
  contestPath: string | null
  /** Whether the contest takes new players */
  isOpen: boolean
  /** Whether a newer year is current */
  isPast: boolean
  /** Whether the contest has no educator */
  isOrphaned: boolean
}) =>
  restoreBy ? (
    <Removed title='This bracket was deleted' contestPath={contestPath}>
      It was deleted from its personal link.{` `}
      {isOrphaned ? (
        CANNOT_RESTORE
      ) : (
        <>
          If that wasn’t you, ask your educator to restore it by{` `}
          <LocalTime date={restoreBy} format={formatLocalDate} />
          {isPast ? null : OR_BEFORE_ARCHIVE}.
        </>
      )}
      {isOpen ? null : ` ${CANNOT_START}`}
    </Removed>
  ) : (
    <Removed
      title='Your educator deleted this bracket'
      contestPath={contestPath}
    >
      {isOrphaned ? CANNOT_RESTORE : ASK_ABOUT_MISTAKE}
      {isOpen ? null : ` ${CANNOT_START}`}
    </Removed>
  )

/** What a player sees right after deleting their own bracket */
export const DeletedOwnBracket = ({
  contestPath,
  isPast,
  isOrphaned,
}: {
  contestPath: string | null
  /** Whether a newer year is current */
  isPast: boolean
  /** Whether the contest has no educator */
  isOrphaned: boolean
}) => (
  <Removed title='Your bracket is deleted' contestPath={contestPath}>
    {isOrphaned
      ? CANNOT_RESTORE
      : `If you change your mind, ask your educator to restore it within ${PLAYER_DELETION_DAYS} days${isPast ? `` : OR_BEFORE_ARCHIVE}.`}
  </Removed>
)
