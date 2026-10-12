import { Button as AriaButton } from 'react-aria-components'
import type { ButtonProps as AriaButtonProps } from 'react-aria-components'

const VARIANT_CLASSES = {
  primary: `bg-accent text-white hover:bg-accent-strong`,
  secondary: `border-2 border-ink bg-white text-ink hover:bg-ink/5`,
  danger: `bg-danger text-white hover:bg-danger-strong`,
}

type ButtonProps = Omit<AriaButtonProps, `className`> & {
  variant?: keyof typeof VARIANT_CLASSES
}

export const Button = ({ variant = `primary`, ...props }: ButtonProps) => (
  <AriaButton
    {...props}
    className={`inline-flex min-h-11 cursor-pointer items-center justify-center px-5 font-condensed text-lg font-bold tracking-wide uppercase outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong data-pending:opacity-70 print:hidden ${VARIANT_CLASSES[variant]}`}
  />
)
