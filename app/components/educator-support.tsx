import { getFormProps } from '@conform-to/react'
import { useState } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { DeleteAccountDialog } from './delete-account-dialog.tsx'
import type { DeletableEducator } from './delete-account-dialog.tsx'
import { FormError } from './form-error.tsx'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import { Notice } from './notice.tsx'
import { isSaved, useIsJustSaved } from './saved-notice.tsx'
import { SettingsSection } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { formatArizonaDate } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { addressSchema } from '~/support-forms.ts'
import type { FoundEducator } from '~/support.server.ts'

/** What the admin sees of an educator and can do for them */
export const EducatorSupport = ({
  educator,
}: {
  educator: FoundEducator & DeletableEducator
}) => (
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

const ChangeAddress = ({ educator }: { educator: FoundEducator }) => {
  const fetcher = useFetcher<SavedResult>()
  const [isOpen, setIsOpen] = useState(false)
  const isSent = isSaved(fetcher)
  const isJustSent = useIsJustSaved(fetcher)
  return (
    <SettingsSection title='Change address'>
      <p className='text-muted'>
        The new address gets a link. The educator keeps the old address until
        they confirm the new one.
      </p>
      <div>
        <DialogTrigger
          isOpen={isOpen && !isSent}
          onOpenChange={open => {
            if (open) {
              fetcher.reset()
            }
            setIsOpen(open)
          }}
        >
          <Button variant='secondary'>Change address</Button>
          <ModalFrame title={`Change ${educator.name}’s address?`}>
            <ChangeAddressForm educator={educator} fetcher={fetcher} />
          </ModalFrame>
        </DialogTrigger>
      </div>
      {isJustSent ? (
        <Notice kind='status'>
          We emailed the new address. The educator’s address changes once they
          confirm it
        </Notice>
      ) : null}
    </SettingsSection>
  )
}

const ChangeAddressForm = ({
  educator: { id, email },
  fetcher,
}: {
  educator: FoundEducator
  fetcher: FetcherWithComponents<SavedResult>
}) => {
  const { form, fields } = useValidatedForm(addressSchema, fetcher.data?.result)
  return (
    <fetcher.Form
      method='post'
      action={href(`/admin/educators/:educatorId/address`, {
        educatorId: id,
      })}
      {...getFormProps(form)}
      className='flex flex-col gap-4'
    >
      <p className='wrap-anywhere'>
        {`Once confirmed, it replaces ${email} and signs them out. An address at another domain moves them and their contests to its organization, and ends their shares.`}
      </p>
      <TextField
        {...fieldProps(fields.email)}
        type='email'
        label='New email address'
        autoComplete='off'
        // The dialog opens for typing
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className={BUTTONS_CLASS_NAME}>
        <Button slot='close' variant='secondary'>
          Cancel
        </Button>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          Send link
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
