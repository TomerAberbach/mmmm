import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { contestNameSchema } from '~/contest-forms.ts'

// The form opens for typing, so its field takes focus
export const ContestNameForm = ({
  fetcher,
  action,
  submitLabel,
  defaultName,
  cancelButton,
  onKeyDown,
}: {
  fetcher: FetcherWithComponents<{ result?: SubmissionResult }>
  action: string
  submitLabel: string
  defaultName?: string
  cancelButton: ReactElement
  onKeyDown?: (event: KeyboardEvent) => void
}) => {
  const { form, fields } = useValidatedForm(
    contestNameSchema,
    fetcher.data?.result,
    { name: defaultName },
  )
  return (
    <fetcher.Form
      method='post'
      action={action}
      {...getFormProps(form)}
      onKeyDown={onKeyDown}
      className='flex max-w-xl flex-col gap-4'
    >
      <TextField
        {...fieldProps(fields.name)}
        label='Contest name'
        description='Players see this name when they open the contest link'
        autoComplete='off'
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className='flex flex-wrap gap-3'>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          {submitLabel}
        </Button>
        {cancelButton}
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
