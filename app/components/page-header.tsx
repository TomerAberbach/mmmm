import type { ReactNode } from 'react'
import { PageTitle } from './page-title.tsx'

// The page's title under a small label, such as its year, with the page's main
// action beside them
export const PageHeader = ({
  label,
  title,
  action,
}: {
  label?: string
  title: string
  action?: ReactNode
}) => (
  <div className='flex flex-wrap items-end justify-between gap-x-6 gap-y-3'>
    <div className='flex min-w-0 flex-col gap-1'>
      {label ? (
        <p className='font-condensed text-lg font-bold tracking-widest text-muted uppercase'>
          {label}
        </p>
      ) : null}
      <PageTitle>{title}</PageTitle>
    </div>
    {action}
  </div>
)
