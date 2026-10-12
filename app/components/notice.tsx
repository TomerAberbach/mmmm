import type { ReactNode } from 'react'

const CLASS_NAME = `block border-4 p-4 font-semibold`

// Screen readers announce an alert at once, and a status when the reader is
// idle
export const Notice = ({
  kind,
  id,
  children,
}: {
  kind: `status` | `alert`
  id?: string
  children: ReactNode
}) =>
  kind === `status` ? (
    <output id={id} className={`${CLASS_NAME} border-accent`}>
      {children}
    </output>
  ) : (
    <p role='alert' id={id} className={`${CLASS_NAME} border-danger`}>
      {children}
    </p>
  )
