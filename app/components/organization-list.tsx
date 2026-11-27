import { href } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { DeleteOrganizationDialog } from './delete-organization-dialog.tsx'
import { InlineEditForm, InlineSaved } from './inline-edit-form.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useInlineEdit } from './use-inline-edit.ts'
import { useValidatedForm } from './use-validated-form.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'
import { organizationRenameSchema } from '~/organization-forms.ts'
import type { OrganizationRow } from '~/organizations.server.ts'

/** Every organization, each with Rename */
export const OrganizationList = ({
  organizations,
}: {
  organizations: OrganizationRow[]
}) =>
  organizations.length === 0 ? (
    <p className='text-muted'>No organizations yet.</p>
  ) : (
    <ul className='max-w-3xl border-t-2 border-ink'>
      {organizations.map(organization => (
        <OrganizationItem
          key={organization.domain}
          organization={organization}
        />
      ))}
    </ul>
  )

/** The row's editor closes once its save succeeds */
const OrganizationItem = ({
  organization,
}: {
  organization: OrganizationRow
}) => {
  const { fetcher, isOpen, isSaved, buttonRef, open, close } = useInlineEdit()
  const { domain, name, educatorCount } = organization
  return (
    <li className='flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-muted-light py-2'>
      <div className='min-w-0'>
        <p
          className={`wrap-anywhere ${name === null ? `text-muted` : `font-semibold`}`}
        >
          {name ?? `Not named yet`}
          <InlineSaved isSaved={isSaved} />
        </p>
        <p className='text-muted'>
          {`${domain} · ${formatCount(educatorCount, `educator`)}`}
        </p>
      </div>
      {isOpen ? (
        <RenameForm
          organization={organization}
          fetcher={fetcher}
          onCancel={close}
        />
      ) : (
        <div className='flex flex-wrap gap-2'>
          <Button
            ref={buttonRef}
            variant='quiet'
            onPress={open}
            aria-label={`Rename ${name ?? domain}`}
          >
            Rename
          </Button>
          <DeleteOrganizationDialog domain={domain} />
        </div>
      )}
    </li>
  )
}

const RenameForm = ({
  organization: { domain, name },
  fetcher,
  onCancel,
}: {
  organization: OrganizationRow
  fetcher: FetcherWithComponents<SavedResult>
  onCancel: () => void
}) => {
  const { form, fields } = useValidatedForm(
    organizationRenameSchema,
    fetcher.data?.result,
    { domain, name: name ?? undefined },
  )
  return (
    <InlineEditForm
      form={form}
      fetcher={fetcher}
      action={href(`/admin/organizations/rename`)}
      onCancel={onCancel}
    >
      <input type='hidden' name={fields.domain.name} value={domain} />
      <TextField
        {...fieldProps(fields.name)}
        label={`New name for ${name ?? domain}`}
        autoComplete='off'
        // The row opens for typing, as a Rename press asks
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
    </InlineEditForm>
  )
}
