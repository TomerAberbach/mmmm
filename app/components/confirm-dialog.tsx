import { useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'

type ConfirmDialogProps = {
  // The button that opens the dialog
  trigger: ReactElement
  // A question that names the change, such as "Delete Period 5 Biology?"
  title: string
  // What will change, and whether it can be undone
  children: ReactNode
  // The action itself, such as "Delete contest". Never "OK"
  confirmLabel: string
  // The route action that makes the change. It returns a ConfirmResult
  action: string
  fields?: Record<string, string>
}

export type ConfirmResult = { ok: true } | { error: string }

const NO_FIELDS: Record<string, string> = {}

// Confirms a destructive or hard-to-undo action, which the route action then
// performs. Focus starts on Cancel, and Escape cancels. The dialog stays open
// to show an error the action returns
export const ConfirmDialog = ({
  trigger,
  title,
  children,
  confirmLabel,
  action,
  fields = NO_FIELDS,
}: ConfirmDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const fetcher = useFetcher<ConfirmResult>()
  const result = fetcher.state === `idle` ? fetcher.data : undefined
  const descriptionId = useId()

  const changeOpen = (open: boolean) => {
    if (open) {
      // Each opening starts without the last attempt's result
      fetcher.reset()
    }
    setIsOpen(open)
  }

  return (
    <DialogTrigger
      isOpen={isOpen && !(result && `ok` in result)}
      onOpenChange={changeOpen}
    >
      {trigger}
      <ModalOverlay className='fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4'>
        <Modal className='w-full max-w-lg'>
          <Dialog
            role='alertdialog'
            aria-describedby={descriptionId}
            className='flex flex-col gap-3 border-2 border-ink bg-white p-6 shadow-[8px_8px_0] shadow-accent-soft outline-none'
          >
            <Heading
              slot='title'
              className='font-condensed text-3xl leading-tight font-extrabold uppercase'
            >
              {title}
            </Heading>
            <div id={descriptionId}>{children}</div>
            {result && `error` in result ? (
              <p role='alert' className='font-semibold text-danger'>
                {result.error}
              </p>
            ) : null}
            <fetcher.Form
              method='post'
              action={action}
              className='mt-2 flex flex-wrap justify-end gap-3'
            >
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type='hidden' name={name} value={value} />
              ))}
              {/* The least destructive choice gets focus, as the WAI-ARIA alert dialog
                  pattern advises */}
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <Button slot='close' variant='secondary' autoFocus>
                Cancel
              </Button>
              <Button
                type='submit'
                variant='danger'
                isPending={fetcher.state !== `idle`}
              >
                {confirmLabel}
              </Button>
            </fetcher.Form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
