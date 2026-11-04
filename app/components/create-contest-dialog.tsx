import type { SubmissionResult } from '@conform-to/react'
import { use } from 'react'
import {
  DialogTrigger,
  OverlayTriggerStateContext,
} from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ContestNameForm } from './contest-name-form.tsx'
import { ModalFrame } from './modal-frame.tsx'

// The action redirects to the new contest's page once it saves
export const CreateContestDialog = () => (
  <DialogTrigger>
    <Button>Create contest</Button>
    <ModalFrame title='Create contest'>
      <CreateContestForm />
    </ModalFrame>
  </DialogTrigger>
)

// Mounts with each opening, so the form starts empty
const CreateContestForm = () => {
  const dialog = use(OverlayTriggerStateContext)
  return (
    <ContestNameForm
      fetcher={useFetcher<{ result: SubmissionResult }>()}
      action={href(`/contests/new`)}
      submitLabel='Create contest'
      onCancel={() => dialog?.close()}
    />
  )
}
