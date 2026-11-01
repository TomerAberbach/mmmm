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
import { StableLabel } from './stable-label.tsx'

type TextFieldProps = Omit<
  AriaTextFieldProps,
  `className` | `children` | `isInvalid` | `validationBehavior`
> & {
  label: string
  description?: string
  error?: string
  // For a field the layout already labels visually. Screen readers still read
  // the label
  hideLabel?: boolean
  // Shown beside the input
  children?: ReactNode
}

// Shows only the error it's given, so the form decides when to validate. The
// error goes under the input, so the input stays put when the error appears
export const TextField = ({
  label,
  description,
  error,
  hideLabel = false,
  children,
  ...props
}: TextFieldProps) => (
  <AriaTextField
    {...props}
    isInvalid={Boolean(error)}
    validationBehavior='aria'
    className='flex flex-col gap-1'
  >
    <Label className={`font-semibold ${hideLabel ? `sr-only` : ``}`}>
      {label}
    </Label>
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
        <StableLabel labels={[`Show`, `Hide`]} shown={shownLabel} />
      </Button>
    </TextField>
  )
}

// TextField shows one error, so this passes the field's first. A field that
// remounts starts from the value last typed in it, and its id lets an error
// summary link to it
export const fieldProps = (
  field: FieldMetadata<string>,
): Pick<TextFieldProps, `id` | `name` | `defaultValue` | `error`> => ({
  id: field.id,
  name: field.name,
  defaultValue: field.value ?? field.initialValue,
  error: field.errors?.[0],
})
