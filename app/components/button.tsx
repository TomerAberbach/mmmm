import type { Ref } from 'react'
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components'
import type {
  ButtonProps as AriaButtonProps,
  LinkProps as AriaLinkProps,
} from 'react-aria-components'

const TEXT_CLASSES = `text-accent-strong underline underline-offset-2 hover:bg-ink/5`

const VARIANT_CLASSES = {
  primary: `px-5 bg-accent text-white hover:bg-accent-strong`,
  secondary: `px-5 border-2 border-ink bg-white text-ink hover:bg-ink/5`,
  danger: `px-5 bg-danger text-white hover:bg-danger-strong`,
  // For an action repeated down a list, where a full button on every row
  // would crowd it
  quiet: `px-5 ${TEXT_CLASSES}`,
  // For a row that wraps, where padding would indent a line that a button starts
  bar: TEXT_CLASSES,
}

type Variant = keyof typeof VARIANT_CLASSES

const BASE_CLASSES = `inline-flex min-h-11 cursor-pointer items-center justify-center font-condensed text-lg font-bold tracking-wide uppercase outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong data-disabled:cursor-not-allowed data-disabled:opacity-50 print:hidden`

type ButtonProps = Omit<AriaButtonProps, `className`> & {
  variant?: Variant
  ref?: Ref<HTMLButtonElement>
}

export const Button = ({ variant = `primary`, ...props }: ButtonProps) => (
  <AriaButton
    {...props}
    className={`${BASE_CLASSES} data-pending:opacity-70 ${VARIANT_CLASSES[variant]}`}
  />
)

type ButtonLinkProps = Omit<AriaLinkProps, `className`> & { variant?: Variant }

/** For navigation. Use Button for an action */
export const ButtonLink = ({
  variant = `primary`,
  ...props
}: ButtonLinkProps) => (
  <AriaLink
    {...props}
    className={`${BASE_CLASSES} no-underline ${VARIANT_CLASSES[variant]}`}
  />
)
