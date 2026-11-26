import { Button } from './button.tsx'
import { BUTTONS_CLASS_NAME } from './modal-frame.tsx'

/** The last row of a dialog whose form makes a hard-to-undo change */
export const DangerButtons = ({
  confirmLabel,
  isPending,
}: {
  confirmLabel: string
  isPending: boolean
}) => (
  <div className={BUTTONS_CLASS_NAME}>
    {/* The least destructive choice gets focus, as in ConfirmDialog */}
    <Button
      slot='close'
      variant='secondary'
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
    >
      Cancel
    </Button>
    <Button type='submit' variant='danger' isPending={isPending}>
      {confirmLabel}
    </Button>
  </div>
)
