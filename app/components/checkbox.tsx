import type { ReactNode } from 'react'
import { CheckboxButton, CheckboxField } from 'react-aria-components'
import type { CheckboxFieldProps } from 'react-aria-components'

type CheckboxProps = Omit<CheckboxFieldProps, `className` | `children`> & {
  children: ReactNode
  /** Hides the label from all but screen readers */
  hideLabel?: boolean
}

export const Checkbox = ({
  children,
  hideLabel = false,
  ...props
}: CheckboxProps) => (
  <CheckboxField {...props}>
    <CheckboxButton className='group relative flex cursor-pointer items-start gap-3 font-semibold'>
      <span
        aria-hidden='true'
        className='mt-0.5 flex size-6 shrink-0 items-center justify-center border-2 border-ink bg-white text-white group-data-focus-visible:outline-3 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-accent-strong group-data-indeterminate:border-accent group-data-indeterminate:bg-accent group-data-selected:border-accent group-data-selected:bg-accent'
      >
        <svg viewBox='0 0 16 16' className='size-4' fill='none'>
          <path
            d='M3 8.5l3 3 7-7'
            stroke='currentColor'
            strokeWidth='2.5'
            className='hidden group-data-indeterminate:hidden group-data-selected:block'
          />
          <path
            d='M3 8h10'
            stroke='currentColor'
            strokeWidth='2.5'
            className='hidden group-data-indeterminate:block'
          />
        </svg>
      </span>
      <span className={hideLabel ? `sr-only` : undefined}>{children}</span>
    </CheckboxButton>
  </CheckboxField>
)
