import { useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { DialogError } from './fetcher-error.tsx'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import { Notice } from './notice.tsx'
import { useIsLatestAction } from './use-is-latest-action.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'

type ConfirmDialogProps = {
  /** A question that names the change, such as "Delete Period 5 Biology?" */
  title: string
  /** What will change, and whether it can be undone */
  children: ReactNode
  /** The action itself, such as "Delete contest". Never "OK" */
  confirmLabel: string
  /**
   * `primary` for an action that adds rather than removes, such as publishing
   */
  confirmVariant?: `danger` | `primary`
} & (
  | {
      /** The route action that makes the change. It returns a `ConfirmReply` */
      action: string
      fields?: Record<string, string>
    }
  // Makes the change in the page. The dialog closes when it settles
  | { onConfirm: () => void | Promise<void> }
) &
  (
    | {
        /** The button that opens the dialog */
        trigger: ReactElement
        /**
         * Shown after the trigger once the route action makes the change, until
         * a later action
         */
        successNotice?: string
      }
    // Opens the dialog from elsewhere, such as a menu
    | { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }
  )

const NO_FIELDS: Record<string, string> = {}

/**
 * Confirms a destructive or hard-to-undo action, which the route action or
 * `onConfirm` then performs. Focus starts on Cancel, and Escape cancels until
 * `onConfirm` starts. The dialog stays open to show an error the route action
 * returns
 */
export const ConfirmDialog = ({
  title,
  children,
  confirmLabel,
  confirmVariant = `danger`,
  ...props
}: ConfirmDialogProps) => {
  const [isTriggerOpen, setIsTriggerOpen] = useState(false)
  const [isOpen, setIsOpen] =
    `trigger` in props
      ? [isTriggerOpen, setIsTriggerOpen]
      : [props.isOpen, props.onOpenChange]
  const fetcher = useFetcher<ConfirmResult>()
  const result = fetcher.state === `idle` ? fetcher.data : undefined
  const isLatest = useIsLatestAction(fetcher)
  const descriptionId = useId()

  const [isConfirming, setIsConfirming] = useState(false)

  const changeOpen = (open: boolean) => {
    // Closing can't take back a change already under way
    if (isConfirming) {
      return
    }
    if (open) {
      // Each opening starts without the last attempt's result
      fetcher.reset()
    }
    setIsOpen(open)
  }

  const confirm = async (onConfirm: () => void | Promise<void>) => {
    setIsConfirming(true)
    try {
      await onConfirm()
    } finally {
      setIsConfirming(false)
      setIsOpen(false)
    }
  }

  const buttons = (confirmButton: ReactElement) => (
    <>
      {/* The least destructive choice gets focus, as the WAI-ARIA alert dialog
        pattern advises */}
      <Button
        slot='close'
        variant='secondary'
        isDisabled={isConfirming}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      >
        Cancel
      </Button>
      {confirmButton}
    </>
  )
  // Resetting a fetcher sets its data to null
  const isDone = Boolean(result && `ok` in result)
  const isShown = isOpen && !isDone
  const frame = (
    <ModalFrame
      isOpen={isShown}
      onOpenChange={changeOpen}
      role='alertdialog'
      aria-describedby={descriptionId}
      title={title}
    >
      <div id={descriptionId}>{children}</div>
      {`onConfirm` in props ? (
        <div className={BUTTONS_CLASS_NAME}>
          {buttons(
            <Button
              variant={confirmVariant}
              isPending={isConfirming}
              onPress={() => void confirm(props.onConfirm)}
            >
              {confirmLabel}
            </Button>,
          )}
        </div>
      ) : (
        <fetcher.Form
          method='post'
          action={props.action}
          className={BUTTONS_CLASS_NAME}
        >
          {Object.entries(props.fields ?? NO_FIELDS).map(([name, value]) => (
            <input key={name} type='hidden' name={name} value={value} />
          ))}
          {buttons(
            <Button
              type='submit'
              variant={confirmVariant}
              isPending={fetcher.state !== `idle`}
            >
              {confirmLabel}
            </Button>,
          )}
        </fetcher.Form>
      )}
      <DialogError fetcher={fetcher} />
    </ModalFrame>
  )
  const notice =
    isDone && isLatest && `successNotice` in props && props.successNotice ? (
      <Notice kind='status'>{props.successNotice}</Notice>
    ) : null
  return `trigger` in props ? (
    <>
      <DialogTrigger isOpen={isShown} onOpenChange={changeOpen}>
        {props.trigger}
        {frame}
      </DialogTrigger>
      {notice}
    </>
  ) : (
    frame
  )
}
