import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import type { DialogProps } from 'react-aria-components'

/**
 * The overlay, the box, and the title every modal dialog shares. Place it in a
 * DialogTrigger after the trigger, or pass `isOpen` and `onOpenChange` for a
 * dialog without one
 */
export const ModalFrame = ({
  title,
  isOpen,
  onOpenChange,
  children,
  ...props
}: Omit<DialogProps, `className` | `children`> & {
  title: string
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  children: ReactNode
}) => (
  <ModalOverlay
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    className='fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4'
  >
    <Modal className='w-full max-w-lg'>
      <Dialog
        {...props}
        className='flex flex-col gap-3 border-2 border-ink bg-white p-6 shadow-offset shadow-accent-soft outline-none'
      >
        <Heading
          slot='title'
          className='font-condensed text-3xl leading-tight font-extrabold uppercase'
        >
          {title}
        </Heading>
        {children}
      </Dialog>
    </Modal>
  </ModalOverlay>
)

/** A dialog's last row */
export const BUTTONS_CLASS_NAME = `mt-2 flex flex-wrap justify-end gap-3`
