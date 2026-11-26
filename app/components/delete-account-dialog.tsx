import { getFormProps } from '@conform-to/react'
import type { ReactElement } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { accountDeletionSchema } from '~/account-deletion-forms.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'

export type DeletableEducator = { email: string; contestCount: number }

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
  account: { email, contestCount },
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
              Players keep their personal links, and approved brackets stay on
              leaderboards.
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
      <div className={BUTTONS_CLASS_NAME}>
        {/* The least destructive choice gets focus, as in ConfirmDialog */}
        <Button
          slot='close'
          variant='secondary'
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        >
          Cancel
        </Button>
        <Button
          type='submit'
          variant='danger'
          isPending={fetcher.state !== `idle`}
        >
          Delete account
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
