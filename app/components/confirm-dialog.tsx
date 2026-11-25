import { useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { FetcherError } from './fetcher-error.tsx'
import { ModalFrame } from './modal-frame.tsx'

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
      /** The route action that makes the change. It returns a ConfirmResult */
      action: string
      fields?: Record<string, string>
      /**
       * Lets the page read the result with `useFetcher({ key })` once the
       * dialog closes
       */
      fetcherKey?: string
    }
  // Makes the change in the page. The dialog closes when it's called
  | { onConfirm: () => void }
) &
  (
    | {
        /** The button that opens the dialog */
        trigger: ReactElement
      }
    // Opens the dialog from elsewhere, such as a menu
    | { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }
  )

export type ConfirmResult = { ok: true } | { error: string }

const NO_FIELDS: Record<string, string> = {}

/**
 * Confirms a destructive or hard-to-undo action, which the route action or
 * `onConfirm` then performs. Focus starts on Cancel, and Escape cancels. The
 * dialog stays open to show an error the route action returns
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
  const fetcher = useFetcher<ConfirmResult>({
    key: `fetcherKey` in props ? props.fetcherKey : undefined,
  })
  const result = fetcher.state === `idle` ? fetcher.data : undefined
  const descriptionId = useId()

  const changeOpen = (open: boolean) => {
    if (open) {
      // Each opening starts without the last attempt's result
      fetcher.reset()
    }
    setIsOpen(open)
  }

  const buttons = (confirmButton: ReactElement) => (
    <>
      {/* The least destructive choice gets focus, as the WAI-ARIA alert dialog
        pattern advises */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <Button slot='close' variant='secondary' autoFocus>
        Cancel
      </Button>
      {confirmButton}
    </>
  )
  const isShown = isOpen && !(result && `ok` in result)
  const frame = (
    <ModalFrame
      isOpen={isShown}
      onOpenChange={changeOpen}
      role='alertdialog'
      aria-describedby={descriptionId}
      title={title}
    >
      <div id={descriptionId}>{children}</div>
      <FetcherError fetcher={fetcher} />
      {`onConfirm` in props ? (
        <div className={BUTTONS_CLASS_NAME}>
          {buttons(
            <Button
              slot='close'
              variant={confirmVariant}
              onPress={props.onConfirm}
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
    </ModalFrame>
  )
  return `trigger` in props ? (
    <DialogTrigger isOpen={isShown} onOpenChange={changeOpen}>
      {props.trigger}
      {frame}
    </DialogTrigger>
  ) : (
    frame
  )
}

const BUTTONS_CLASS_NAME = `mt-2 flex flex-wrap justify-end gap-3`
