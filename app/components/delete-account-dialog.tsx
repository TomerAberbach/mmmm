import { getFormProps } from '@conform-to/react'
import type { ReactElement } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { useFetcher } from 'react-router'
import { DangerButtons } from './danger-buttons.tsx'
import { FormError } from './form-error.tsx'
import { ModalFrame } from './modal-frame.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { accountDeletionSchema } from '~/account-deletion-forms.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'

export type DeletableEducator = {
  email: string
  contestCount: number
  isConfirmed: boolean
}

/** Deletes an account once its email address is typed */
export const DeleteAccountDialog = ({
  trigger,
  title,
  account,
  action,
}: {
  trigger: ReactElement
  /** A question that names the account */
  title: string
  account: DeletableEducator
  /** The route action that deletes the account */
  action: string
}) => (
  <DialogTrigger>
    {trigger}
    <ModalFrame title={title} role='alertdialog'>
      <DeleteAccountForm account={account} action={action} />
    </ModalFrame>
  </DialogTrigger>
)

/** Mounts with each opening, so the form starts empty */
const DeleteAccountForm = ({
  account: { email, contestCount, isConfirmed },
  action,
}: {
  account: DeletableEducator
  action: string
}) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    accountDeletionSchema,
    fetcher.data?.result,
  )
  return (
    <fetcher.Form
      method='post'
      action={action}
      {...getFormProps(form)}
      className='flex flex-col gap-4'
    >
      <p>
        This can’t be undone, though backups keep the data for up to 30 days.
      </p>
      <ul className='flex list-disc flex-col gap-1 ps-5'>
        {contestCount > 0 ? (
          <>
            <li>
              {`${formatCount(contestCount, `contest`)} ${contestCount === 1 ? `stays` : `stay`} without an educator, so no one can start a bracket from a contest link, and pending brackets stay pending.`}
            </li>
            <li>
              {isConfirmed
                ? `Players keep their personal links, and approved brackets stay on leaderboards.`
                : `Players keep their personal links. Approved brackets stay on their contest’s leaderboard, and off the organization and global ones.`}
            </li>
          </>
        ) : null}
        <li>Sharing contests to and from the account ends.</li>
      </ul>
      <TextField
        {...fieldProps(fields.email)}
        type='email'
        label={`Type ${email} to confirm`}
        autoComplete='off'
      />
      <DangerButtons
        confirmLabel='Delete account'
        isPending={fetcher.state !== `idle`}
      />
      <FormError form={form} />
    </fetcher.Form>
  )
}
