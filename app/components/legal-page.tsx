import type { ReactNode } from 'react'
import { PageTitle } from './page-title.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'

/** A page a lawyer hasn't reviewed yet, so it says it's a draft */
export const LegalPage = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <div className='flex max-w-prose flex-col gap-8'>
    <PageTitle>{title}</PageTitle>
    <p className='border-l-8 border-accent-soft py-2 pl-4'>
      This is a draft. A lawyer will review it before MMMM launches.
    </p>
    {children}
  </div>
)

export const LegalSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <section className='flex flex-col gap-3'>
    <h2 className={SECTION_HEADING_CLASS_NAME}>{title}</h2>
    {children}
  </section>
)
