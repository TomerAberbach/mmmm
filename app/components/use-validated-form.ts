import { useForm } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { useNavigation } from 'react-router'
import type { z } from 'zod'

type Form<Schema extends z.ZodObject> = ReturnType<
  typeof useForm<z.input<Schema>, z.output<Schema>>
>

// Validates only once the form is first submitted, then again on each keystroke
export const useValidatedForm = <Schema extends z.ZodObject>(
  schema: Schema,
  lastResult: SubmissionResult | undefined,
): {
  form: Form<Schema>[0]
  fields: Form<Schema>[1]
  isSubmitting: boolean
} => {
  const [form, fields] = useForm<z.input<Schema>, z.output<Schema>>({
    lastResult,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    shouldValidate: `onSubmit`,
    shouldRevalidate: `onInput`,
  })
  return { form, fields, isSubmitting: useNavigation().state === `submitting` }
}
