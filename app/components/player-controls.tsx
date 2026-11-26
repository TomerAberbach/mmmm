import { DialogTrigger } from 'react-aria-components'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { CopyButton } from './copy-button.tsx'
import { LocalTime } from './local-time.tsx'
import { ModalFrame } from './modal-frame.tsx'
import { formatDateTime } from '~/dates.ts'
import type { Submission } from '~/player-picks.server.ts'
import { PLAYER_DELETION_DAYS } from '~/trash.ts'

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
      It opens your bracket on any device, now and after this computer forgets
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
  variant,
  isSending,
}: {
  forgetPath: string
  variant: `quiet` | `secondary`
  /** A response still in flight would make this computer remember again */
  isSending: boolean
}) => (
  <ConfirmDialog
    trigger={
      <Button variant={variant} isDisabled={isSending}>
        Done, forget this computer
      </Button>
    }
    title='Forget this computer?'
    confirmLabel='Forget this computer'
    confirmVariant='primary'
    action={forgetPath}
  >
    <p>
      This computer will stop opening your bracket. To come back to it, you’ll
      need your personal link.
    </p>
  </ConfirmDialog>
)

export const DeleteButton = ({
  deletePath,
  playerId,
  isSending,
  isOpen = true,
}: {
  deletePath: string
  playerId: string
  isSending: boolean
  /** Whether the player can still submit another bracket */
  isOpen?: boolean
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
      {`Your personal link stops working${isOpen ? `` : `, and submissions are closed, so you can’t submit again`}. If you change your mind, ask your educator to restore it within ${PLAYER_DELETION_DAYS} days. After that it’s erased for good.`}
    </p>
  </ConfirmDialog>
)

export const PicksChanged = ({ at }: { at: Date }) => (
  <p className='text-muted'>
    Submitted picks last changed <LocalTime date={at} format={formatDateTime} />
    . If you didn’t make a change, tell your educator.
  </p>
)
