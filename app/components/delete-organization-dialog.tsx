import { getFormProps } from '@conform-to/react'
import { useEffect } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { DangerButtons } from './danger-buttons.tsx'
import { FormError } from './form-error.tsx'
import { ModalFrame } from './modal-frame.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'
import { organizationDeletionSchema } from '~/support-forms.ts'
import type { OrganizationData } from '~/support.server.ts'

/** Deletes an organization's data once its domain is typed */
export const DeleteOrganizationDialog = ({ domain }: { domain: string }) => (
  <DialogTrigger>
    <Button variant='quiet' aria-label={`Delete data from ${domain}`}>
      Delete data
    </Button>
    <ModalFrame title={`Delete all data from ${domain}?`} role='alertdialog'>
      <DeleteOrganizationForm domain={domain} />
    </ModalFrame>
  </DialogTrigger>
)

/** Mounts with each opening, so the counts are current and the form is empty */
const DeleteOrganizationForm = ({ domain }: { domain: string }) => {
  const counts = useFetcher<OrganizationData>()
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    organizationDeletionSchema,
    fetcher.data?.result,
    { domain },
  )
  const { load } = counts
  useEffect(() => {
    void load(
      `${href(`/admin/organizations/data`)}?${new URLSearchParams({ domain }).toString()}`,
    )
  }, [load, domain])

  return (
    <fetcher.Form
      method='post'
      action={href(`/admin/organizations/delete`)}
      {...getFormProps(form)}
      className='flex flex-col gap-4'
    >
      <p>
        {counts.data
          ? `This deletes ${formatCount(counts.data.educatorCount, `account`)}, ${formatCount(counts.data.contestCount, `contest`)}, and ${formatCount(counts.data.playerCount, `bracket`)}, past years included.`
          : `This deletes its accounts, contests, and brackets, past years included.`}
        {` `}
        It can’t be undone, though backups keep the data for up to 30 days.
      </p>
      <input type='hidden' name={fields.domain.name} value={domain} />
      <TextField
        {...fieldProps(fields.confirmation)}
        label={`Type ${domain} to confirm`}
        autoComplete='off'
        spellCheck='false'
      />
      <DangerButtons
        confirmLabel='Delete all data'
        isPending={fetcher.state !== `idle`}
      />
      <FormError form={form} />
    </fetcher.Form>
  )
}
