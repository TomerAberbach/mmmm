import { getFormProps } from '@conform-to/react'
import { useState } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import { isSaved } from './saved-notice.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { handOverSchema } from '~/support-forms.ts'

/** `educator` names who would run the contest, before they do */
export type HandOverReply = SavedResult & {
  educator?: { id: string; name: string }
}

/** Finds the new educator by address, then names them before the handover */
export const HandOverDialog = ({
  contest,
}: {
  contest: { id: string; name: string }
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const fetcher = useFetcher<HandOverReply>()
  const isDone = isSaved(fetcher)

  const changeOpen = (open: boolean) => {
    if (open) {
      fetcher.reset()
    }
    setIsOpen(open)
  }

  return (
    <DialogTrigger isOpen={isOpen && !isDone} onOpenChange={changeOpen}>
      <Button variant='quiet' aria-label={`Hand over ${contest.name}`}>
        Hand over
      </Button>
      <ModalFrame title={`Hand over ${contest.name}?`}>
        <HandOverForm contest={contest} fetcher={fetcher} />
      </ModalFrame>
    </DialogTrigger>
  )
}

const HandOverForm = ({
  contest: { id, name },
  fetcher,
}: {
  contest: { id: string; name: string }
  fetcher: FetcherWithComponents<HandOverReply>
}) => {
  const { form, fields } = useValidatedForm(
    handOverSchema,
    fetcher.data?.result,
    { contestId: id },
  )
  const educator = fetcher.data?.educator ?? null
  return (
    <fetcher.Form
      method='post'
      action={href(`/admin/contests/hand-over`)}
      {...getFormProps(form)}
      className='flex flex-col gap-4'
    >
      <input type='hidden' name={fields.contestId.name} value={id} />
      {educator ? (
        <input
          type='hidden'
          name={fields.educatorId.name}
          value={educator.id}
        />
      ) : null}
      <p>
        {educator
          ? `${educator.name} runs ${name} from then on, with its trash and pending brackets.`
          : `The new educator runs it from then on, with its trash and pending brackets.`}
      </p>
      <TextField
        {...fieldProps(fields.email)}
        type='email'
        label='New educator’s email address'
        autoComplete='off'
        isReadOnly={educator !== null}
      />
      <div className={BUTTONS_CLASS_NAME}>
        <Button slot='close' variant='secondary'>
          Cancel
        </Button>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          {educator ? `Hand over to ${educator.name}` : `Find educator`}
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
