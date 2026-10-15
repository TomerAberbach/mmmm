import { CheckboxButton, CheckboxField } from 'react-aria-components'
import type { CheckboxFieldProps } from 'react-aria-components'

type CheckboxProps = Omit<CheckboxFieldProps, `className` | `children`> & {
  children: string
}

export const Checkbox = ({ children, ...props }: CheckboxProps) => (
  <CheckboxField {...props}>
    <CheckboxButton className='group flex cursor-pointer items-start gap-3 font-semibold'>
      <span
        aria-hidden='true'
        className='mt-0.5 flex size-6 shrink-0 items-center justify-center border-2 border-ink bg-white text-white group-data-focus-visible:outline-3 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-accent-strong group-data-selected:border-accent group-data-selected:bg-accent'
      >
        <svg viewBox='0 0 16 16' className='size-4' fill='none'>
          <path
            d='M3 8.5l3 3 7-7'
            stroke='currentColor'
            strokeWidth='2.5'
            className='hidden group-data-selected:block'
          />
        </svg>
      </span>
      {children}
    </CheckboxButton>
  </CheckboxField>
)
