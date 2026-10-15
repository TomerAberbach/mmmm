import { Button as AriaButton, Link as AriaLink } from 'react-aria-components'
import type {
  ButtonProps as AriaButtonProps,
  LinkProps as AriaLinkProps,
} from 'react-aria-components'

const VARIANT_CLASSES = {
  primary: `bg-accent text-white hover:bg-accent-strong`,
  secondary: `border-2 border-ink bg-white text-ink hover:bg-ink/5`,
  danger: `bg-danger text-white hover:bg-danger-strong`,
}

type Variant = keyof typeof VARIANT_CLASSES

const BASE_CLASSES = `inline-flex min-h-11 cursor-pointer items-center justify-center px-5 font-condensed text-lg font-bold tracking-wide uppercase outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong data-disabled:cursor-not-allowed data-disabled:opacity-50 print:hidden`

type ButtonProps = Omit<AriaButtonProps, `className`> & { variant?: Variant }

export const Button = ({ variant = `primary`, ...props }: ButtonProps) => (
  <AriaButton
    {...props}
    className={`${BASE_CLASSES} data-pending:opacity-70 ${VARIANT_CLASSES[variant]}`}
  />
)

type ButtonLinkProps = Omit<AriaLinkProps, `className`> & { variant?: Variant }

// For navigation. Use Button for an action
export const ButtonLink = ({
  variant = `primary`,
  ...props
}: ButtonLinkProps) => (
  <AriaLink
    {...props}
    className={`${BASE_CLASSES} no-underline ${VARIANT_CLASSES[variant]}`}
  />
)
