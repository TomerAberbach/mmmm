import { getFormProps } from '@conform-to/react'
import type { FormMetadata } from '@conform-to/react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import type { SavedResult } from '~/form-replies.server.ts'

/** Beside the name that an editor saved */
export const InlineSaved = ({ isSaved }: { isSaved: boolean }) =>
  isSaved ? (
    <output className='ms-2 font-normal text-accent-strong'>Saved</output>
  ) : null

/** A form that `useInlineEdit` opens in a row. Escape cancels */
export const InlineEditForm = <Fields extends Record<string, unknown>>({
  form,
  fetcher,
  action,
  onCancel,
  children,
}: {
  form: FormMetadata<Fields>
  fetcher: FetcherWithComponents<SavedResult>
  action: string
  onCancel: () => void
  /** The fields */
  children: ReactNode
}) => {
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === `Escape`) {
      // Keeps whatever holds the row from also acting on it
      event.preventDefault()
      onCancel()
    }
  }
  return (
    <fetcher.Form
      method='post'
      action={action}
      {...getFormProps(form)}
      onKeyDown={cancelOnEscape}
      className='flex w-full max-w-xl flex-col gap-2'
    >
      {children}
      <div className='flex gap-2'>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          Save
        </Button>
        <Button variant='secondary' onPress={onCancel}>
          Cancel
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
