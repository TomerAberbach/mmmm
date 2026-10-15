import type { ComponentProps } from 'react'
import { TextField } from './text-field.tsx'

// Follows GOV.UK's security code pattern: a text input that opens the numeric
// keypad, so the code keeps a leading zero, and that a phone can fill in
export const SecurityCodeField = (
  props: Pick<
    ComponentProps<typeof TextField>,
    `name` | `defaultValue` | `error`
  >,
) => (
  <TextField
    {...props}
    label='Security code'
    description='The 6-digit code from your authenticator app'
    inputMode='numeric'
    autoComplete='one-time-code'
    spellCheck='false'
  />
)
