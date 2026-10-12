import type { FieldMetadata } from '@conform-to/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  TextField as AriaTextField,
  FieldError,
  Input,
  Label,
  Text,
} from 'react-aria-components'
import type { TextFieldProps as AriaTextFieldProps } from 'react-aria-components'
import { Button } from './button.tsx'

type TextFieldProps = Omit<
  AriaTextFieldProps,
  `className` | `children` | `isInvalid` | `validationBehavior`
> & {
  label: string
  description?: string
  error?: string
  // Shown beside the input
  children?: ReactNode
}

// Shows only the error it's given, so the form decides when to validate. The
// error goes under the input, so the input stays put when the error appears
export const TextField = ({
  label,
  description,
  error,
  children,
  ...props
}: TextFieldProps) => (
  <AriaTextField
    {...props}
    isInvalid={Boolean(error)}
    validationBehavior='aria'
    className='flex flex-col gap-1'
  >
    <Label className='font-semibold'>{label}</Label>
    {description ? (
      <Text slot='description' className='text-muted'>
        {description}
      </Text>
    ) : null}
    <div className='flex gap-2'>
      <Input className='min-h-11 w-full min-w-0 border-2 border-ink px-3 data-invalid:border-danger' />
      {children}
    </div>
    <FieldError className='font-semibold text-danger'>{error}</FieldError>
  </AriaTextField>
)

export const PasswordField = (
  props: Omit<TextFieldProps, `type` | `children`>,
) => {
  const [isShown, setIsShown] = useState(false)
  const shownLabel = isShown ? `Hide` : `Show`
  return (
    <TextField {...props} type={isShown ? `text` : `password`}>
      <Button
        variant='secondary'
        aria-label={`${shownLabel} password`}
        onPress={() => setIsShown(shown => !shown)}
      >
        {/* Both labels share one grid cell, so the button keeps the wider
            one's width as it toggles */}
        <span className='inline-grid'>
          {[`Show`, `Hide`].map(label => (
            <span
              key={label}
              className={`col-start-1 row-start-1 ${label === shownLabel ? `` : `invisible`}`}
            >
              {label}
            </span>
          ))}
        </span>
      </Button>
    </TextField>
  )
}

// TextField shows one error, so this passes the field's first
export const fieldProps = (
  field: FieldMetadata<string>,
): Pick<TextFieldProps, `name` | `defaultValue` | `error`> => ({
  name: field.name,
  defaultValue: field.initialValue,
  error: field.errors?.[0],
})
