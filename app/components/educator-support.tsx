import { getFormProps } from '@conform-to/react'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { DeleteAccountDialog } from './delete-account-dialog.tsx'
import { FormError } from './form-error.tsx'
import { SavedNotice } from './saved-notice.tsx'
import { SettingsSection } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { formatArizonaDate } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { addressSchema } from '~/support-forms.ts'
import type { FoundEducator } from '~/support.server.ts'

/** What the admin sees of an educator and can do for them */
export const EducatorSupport = ({ educator }: { educator: FoundEducator }) => (
  <div className='flex flex-col divide-y-2 divide-ink border-t-2 border-ink pt-8'>
    <SettingsSection title={educator.name}>
      <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1'>
        {listFacts(educator).map(([label, value]) => (
          <div key={label} className='contents'>
            <dt className='text-muted'>{label}</dt>
            <dd className='font-semibold wrap-anywhere'>{value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
    {educator.isConfirmed ? <ChangeAddress educator={educator} /> : null}
    <SettingsSection title='Delete account'>
      <div>
        <DeleteAccountDialog
          trigger={<Button variant='danger'>Delete account</Button>}
          title={`Delete ${educator.name}’s account?`}
          account={educator}
          action={href(`/admin/educators/:educatorId/delete`, {
            educatorId: educator.id,
          })}
        />
      </div>
    </SettingsSection>
  </div>
)

const listFacts = ({
  email,
  isConfirmed,
  organizationName,
  contestCount,
  createdAt,
}: FoundEducator): [label: string, value: string][] => [
  [`Email address`, `${email}, ${isConfirmed ? `confirmed` : `unconfirmed`}`],
  [`Organization`, organizationName ?? `None`],
  [`Contests`, String(contestCount)],
  [`Signed up`, formatArizonaDate(createdAt)],
]

const ChangeAddress = ({ educator: { id } }: { educator: FoundEducator }) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(addressSchema, fetcher.data?.result)
  return (
    <SettingsSection title='Change address'>
      <p className='text-muted'>
        The new address gets a link. The educator keeps the old address until
        they use it.
      </p>
      <fetcher.Form
        method='post'
        action={href(`/admin/educators/:educatorId/address`, {
          educatorId: id,
        })}
        {...getFormProps(form)}
        className='flex flex-col gap-4'
      >
        <TextField
          key={fields.email.key}
          {...fieldProps(fields.email)}
          type='email'
          label='New email address'
          autoComplete='off'
        />
        <div>
          <Button
            type='submit'
            variant='secondary'
            isPending={fetcher.state !== `idle`}
          >
            Change address
          </Button>
        </div>
        <SavedNotice fetcher={fetcher} isFormValid={form.valid}>
          We emailed the new address. It changes once they confirm it.
        </SavedNotice>
        <FormError form={form} />
      </fetcher.Form>
    </SettingsSection>
  )
}
