import type { SubmissionResult } from '@conform-to/react'
import { DialogTrigger } from 'react-aria-components'
import { useFetcher } from 'react-router'
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
const CreateContestForm = () => (
  <ContestNameForm
    fetcher={useFetcher<{ result: SubmissionResult }>()}
    action='/contests/new'
    submitLabel='Create contest'
    cancelButton={
      <Button slot='close' variant='secondary'>
        Cancel
      </Button>
    }
  />
)
