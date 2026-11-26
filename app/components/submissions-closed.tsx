import type { ReactNode } from 'react'

/** Says why an educator's page lacks what it has while the year is open */
export const SubmissionsClosed = ({ children }: { children: ReactNode }) => (
  <p className='max-w-prose border-2 border-accent p-4'>
    <strong>Submissions are closed.</strong> {children}
  </p>
)
