import { data } from 'react-router'
import type { Route } from './+types/dev.dialog.ts'
import { Button } from '~/components/button.tsx'
import { ConfirmDialog } from '~/components/confirm-dialog.tsx'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { PageTitle } from '~/components/page-title.tsx'

export const meta = () => [{ title: `Sample dialog` }]

let confirmationCount = 0

const requireDevelopment = () => {
  if (!import.meta.env.DEV) {
    throw data(null, { status: 404 })
  }
}

export const loader = () => {
  requireDevelopment()
  return { confirmationCount }
}

export const action = (): ConfirmResult => {
  requireDevelopment()
  confirmationCount++
  return { ok: true }
}

const DevDialog = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col items-start gap-4'>
    <PageTitle>Sample dialog</PageTitle>
    <p>Confirmations so far: {loaderData.confirmationCount}</p>
    <ConfirmDialog
      trigger={<Button variant='danger'>Delete contest</Button>}
      title='Delete Period 5 Biology?'
      confirmLabel='Delete contest'
      action='/dev/dialog'
    >
      This moves the contest and its 27 submissions to the trash. You can
      restore it until the next bracket is published.
    </ConfirmDialog>
  </div>
)
export default DevDialog
