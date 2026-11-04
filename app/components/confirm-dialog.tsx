import { useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ModalFrame } from './modal-frame.tsx'

type ConfirmDialogProps = {
  // The button that opens the dialog
  trigger: ReactElement
  // A question that names the change, such as "Delete Period 5 Biology?"
  title: string
  // What will change, and whether it can be undone
  children: ReactNode
  // The action itself, such as "Delete contest". Never "OK"
  confirmLabel: string
  // `primary` for an action that adds rather than removes, such as publishing
  confirmVariant?: `danger` | `primary`
} & (
  | {
      // The route action that makes the change. It returns a ConfirmResult
      action: string
      fields?: Record<string, string>
      // Lets the page read the result with `useFetcher({ key })` once the
      // dialog closes
      fetcherKey?: string
    }
  // Makes the change in the page. The dialog closes when it's called
  | { onConfirm: () => void }
)

export type ConfirmResult = { ok: true } | { error: string }

const NO_FIELDS: Record<string, string> = {}

// Confirms a destructive or hard-to-undo action, which the route action or
// `onConfirm` then performs. Focus starts on Cancel, and Escape cancels. The
// dialog stays open to show an error the route action returns
export const ConfirmDialog = ({
  trigger,
  title,
  children,
  confirmLabel,
  confirmVariant = `danger`,
  ...change
}: ConfirmDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const fetcher = useFetcher<ConfirmResult>({
    key: `fetcherKey` in change ? change.fetcherKey : undefined,
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
  return (
    <DialogTrigger
      isOpen={isOpen && !(result && `ok` in result)}
      onOpenChange={changeOpen}
    >
      {trigger}
      <ModalFrame
        role='alertdialog'
        aria-describedby={descriptionId}
        title={title}
      >
        <div id={descriptionId}>{children}</div>
        {result && `error` in result ? (
          <p role='alert' className='font-semibold text-danger'>
            {result.error}
          </p>
        ) : null}
        {`onConfirm` in change ? (
          <div className={BUTTONS_CLASS_NAME}>
            {buttons(
              <Button
                slot='close'
                variant={confirmVariant}
                onPress={change.onConfirm}
              >
                {confirmLabel}
              </Button>,
            )}
          </div>
        ) : (
          <fetcher.Form
            method='post'
            action={change.action}
            className={BUTTONS_CLASS_NAME}
          >
            {Object.entries(change.fields ?? NO_FIELDS).map(([name, value]) => (
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
    </DialogTrigger>
  )
}

const BUTTONS_CLASS_NAME = `mt-2 flex flex-wrap justify-end gap-3`
