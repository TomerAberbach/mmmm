import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import type { DialogProps } from 'react-aria-components'

// The overlay, the box, and the title every modal dialog shares. Place it in a
// DialogTrigger after the trigger
export const ModalFrame = ({
  title,
  children,
  ...props
}: Omit<DialogProps, `className` | `children`> & {
  title: string
  children: ReactNode
}) => (
  <ModalOverlay className='fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4'>
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
