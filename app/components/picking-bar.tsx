import type { ReactNode, Ref } from 'react'
import { ClearedNotice } from './cleared-notice.tsx'

/** Sticks above a bracket being picked. A cleared message takes its own row */
export const PickingBar = ({
  ref,
  cleared,
  children,
}: {
  ref: Ref<HTMLDivElement>
  /** What the last change cleared, or null */
  cleared: string | null
  children: ReactNode
}) => (
  <div
    ref={ref}
    data-picking-bar
    className='sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-white py-3 print:hidden'
  >
    {children}
    <ClearedNotice message={cleared} />
  </div>
)

export const BarLabel = ({ children }: { children: string }) => (
  <span className='font-condensed text-xl font-bold uppercase'>{children}</span>
)
