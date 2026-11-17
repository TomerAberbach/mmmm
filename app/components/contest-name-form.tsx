import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { contestNameSchema } from '~/contest-forms.ts'
import { freeTextSchema } from '~/free-text.ts'

const CONTEST_NAME_SCHEMA = contestNameSchema(freeTextSchema)

// The form opens for typing, so its field takes focus. Escape cancels
export const ContestNameForm = ({
  fetcher,
  action,
  submitLabel,
  defaultName,
  onCancel,
}: {
  fetcher: FetcherWithComponents<{ result?: SubmissionResult }>
  action: string
  submitLabel: string
  defaultName?: string
  onCancel: () => void
}) => {
  const { form, fields } = useValidatedForm(
    CONTEST_NAME_SCHEMA,
    fetcher.data?.result,
    { name: defaultName },
  )
  return (
    <fetcher.Form
      method='post'
      action={action}
      {...getFormProps(form)}
      onKeyDown={event => {
        if (event.key === `Escape`) {
          onCancel()
        }
      }}
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
        <Button variant='secondary' onPress={onCancel}>
          Cancel
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
