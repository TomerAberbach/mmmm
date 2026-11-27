import { DialogTrigger } from 'react-aria-components'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { CopyButton } from './copy-button.tsx'
import { LocalTime, useIsHydrated } from './local-time.tsx'
import { ModalFrame } from './modal-frame.tsx'
import { formatDateTime } from '~/dates.ts'
import type { Submission } from '~/player-picks.server.ts'
import { OR_BEFORE_ARCHIVE, PLAYER_DELETION_DAYS } from '~/trash.ts'

/** A player's submission, and the personal link they see once they submit */
export type Submitted = { submission: Submission; personalLink: string }

export const PersonalLink = ({
  personalLink,
  isOpen = true,
}: {
  personalLink: string
  /** Whether the link's holder can still change the picks */
  isOpen?: boolean
}) => (
  <>
    <p>
      It opens your bracket on any device, now and after this device forgets
      you. Paste it somewhere you’ll find it, such as a note or an email to
      yourself. Anyone with it can {isOpen ? `change` : `see`} your picks, so
      keep it to yourself.
    </p>
    <p className='border-2 border-ink bg-white p-3 font-mono text-xl break-all sm:text-2xl'>
      {personalLink}
    </p>
    <div>
      <CopyButton text={personalLink} />
    </div>
  </>
)

export const PersonalLinkButton = (
  props: Parameters<typeof PersonalLink>[0],
) => (
  <DialogTrigger>
    <Button variant='quiet'>Show my personal link</Button>
    <ModalFrame title='Your personal link'>
      <PersonalLink {...props} />
      <div className='mt-2 flex justify-end'>
        <Button slot='close' variant='secondary'>
          Close
        </Button>
      </div>
    </ModalFrame>
  </DialogTrigger>
)

export const ForgetButton = ({
  forgetPath,
  playerId,
  variant,
  isSending,
}: {
  forgetPath: string
  playerId: string
  variant: `quiet` | `secondary`
  /** A response still in flight would make this device remember again */
  isSending: boolean
}) => (
  <ConfirmDialog
    trigger={
      <Button variant={variant} isDisabled={isSending}>
        Done, forget my bracket here
      </Button>
    }
    title='Forget your bracket on this device?'
    confirmLabel='Forget my bracket'
    confirmVariant='primary'
    action={forgetPath}
    // The browser may have remembered another player since the page loaded
    fields={{ playerId }}
  >
    <p>
      This device will stop opening your bracket. To come back to it, you’ll
      need your personal link.
    </p>
  </ConfirmDialog>
)

export const DeleteButton = ({
  deletePath,
  playerId,
  isSending,
  isOrphaned,
  isOpen = true,
  isPast = false,
}: {
  deletePath: string
  playerId: string
  isSending: boolean
  /** Whether the contest has no educator to restore the bracket */
  isOrphaned: boolean
  /** Whether the player can still submit another bracket */
  isOpen?: boolean
  /** Whether a newer year is current */
  isPast?: boolean
}) => (
  <ConfirmDialog
    trigger={
      <Button variant='quiet' isDisabled={isSending}>
        Delete my bracket
      </Button>
    }
    title='Delete your bracket?'
    confirmLabel='Delete my bracket'
    action={deletePath}
    // The browser may have remembered another player since the page loaded
    fields={{ playerId }}
  >
    <p>
      {[
        `Your personal link stops working${isOpen ? `` : `, and submissions are closed, so you can’t submit again`}.`,
        isOrphaned
          ? `Your educator left MMMM, so this can’t be undone.`
          : `If you change your mind, ask your educator to restore it within ${PLAYER_DELETION_DAYS} days${isPast ? `` : OR_BEFORE_ARCHIVE}. After that it’s deleted forever.`,
      ].join(` `)}
    </p>
  </ConfirmDialog>
)

export const PicksChanged = ({
  at,
  isOrphaned,
}: {
  at: Date
  /** Whether the contest has no educator to tell */
  isOrphaned: boolean
}) => (
  // Holds its place until the page hydrates, which fills in the time
  <p className={`text-muted ${useIsHydrated() ? `` : `invisible`}`}>
    Submitted picks last changed <LocalTime date={at} format={formatDateTime} />
    .{isOrphaned ? null : ` If you didn’t make a change, tell your educator.`}
  </p>
)
