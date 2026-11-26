import { getFormProps } from '@conform-to/react'
import { DialogTrigger } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { DangerButtons } from './danger-buttons.tsx'
import { FormError } from './form-error.tsx'
import { ModalFrame } from './modal-frame.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { contestErasureSchema } from '~/contest-forms.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'

type ErasableContest = {
  id: string
  name: string
  /** Trash included */
  playerCount: number
}

/** Erases a contest once its name is typed */
export const EraseContestDialog = ({
  contest,
}: {
  contest: ErasableContest
}) => (
  <DialogTrigger>
    <Button variant='danger'>Delete forever</Button>
    <ModalFrame title={`Delete ${contest.name} forever?`} role='alertdialog'>
      <EraseContestForm contest={contest} />
    </ModalFrame>
  </DialogTrigger>
)

/** Mounts with each opening, so the form starts empty */
const EraseContestForm = ({
  contest: { id, name, playerCount },
}: {
  contest: ErasableContest
}) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    contestErasureSchema,
    fetcher.data?.result,
  )
  return (
    <fetcher.Form
      method='post'
      action={href(`/admin/contests/:contestId/erase-contest`, {
        contestId: id,
      })}
      {...getFormProps(form)}
      className='flex flex-col gap-4'
    >
      <p>
        {`This deletes the contest and its ${formatCount(playerCount, `bracket`)}, trash included. They leave every leaderboard, and the contest link and personal links stop working.`}
      </p>
      <p>
        This can’t be undone, though backups keep the data for up to 30 days.
      </p>
      <TextField
        {...fieldProps(fields.confirmation)}
        label={`Type ${name} to confirm`}
        autoComplete='off'
        spellCheck='false'
      />
      <DangerButtons
        confirmLabel='Delete forever'
        isPending={fetcher.state !== `idle`}
      />
      <FormError form={form} />
    </fetcher.Form>
  )
}
