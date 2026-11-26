import { getFormProps } from '@conform-to/react'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { FormError } from './form-error.tsx'
import { SavedNotice } from './saved-notice.tsx'
import { SettingsSection } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { shareSchema } from '~/share-forms.ts'
import type { Colleague } from '~/shares.server.ts'

/** The colleagues who see the contest, and the form that adds one */
export const ContestShares = ({
  contest,
  colleagues,
  isPast = false,
}: {
  contest: { id: string; name: string }
  colleagues: readonly Colleague[]
  /** Whether a newer year is current, so only Stop sharing is left */
  isPast?: boolean
}) => (
  <div className='print:hidden'>
    <SettingsSection title='Shared with'>
      <p className='max-w-prose'>
        A colleague in your organization can see this contest’s players and
        scores. They can’t change anything.
      </p>
      {colleagues.length > 0 ? (
        <ul className='border-t-2 border-ink'>
          {colleagues.map(colleague => (
            <li
              key={colleague.id}
              className='flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-muted-light py-2'
            >
              <div className='min-w-0'>
                <p className='font-semibold wrap-anywhere'>{colleague.name}</p>
                <p className='wrap-anywhere text-muted'>{colleague.email}</p>
              </div>
              <StopSharing
                contest={contest}
                colleague={colleague}
                isPast={isPast}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {isPast ? null : <ShareForm contestId={contest.id} />}
    </SettingsSection>
  </div>
)

const StopSharing = ({
  contest,
  colleague: { id, name },
  isPast,
}: {
  contest: { id: string; name: string }
  colleague: Colleague
  isPast: boolean
}) => (
  <ConfirmDialog
    trigger={
      <Button variant='quiet' aria-label={`Stop sharing with ${name}`}>
        Stop sharing
      </Button>
    }
    title={`Stop sharing with ${name}?`}
    confirmLabel='Stop sharing'
    action={href(`/contests/:contestId/shares/stop`, { contestId: contest.id })}
    fields={{ colleagueId: id }}
  >
    <p>{`They’ll no longer see the players in ${contest.name}. You ${isPast ? `can’t` : `can`} share it with them again.`}</p>
  </ConfirmDialog>
)

const ShareForm = ({ contestId }: { contestId: string }) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(shareSchema, fetcher.data?.result)
  return (
    <fetcher.Form
      method='post'
      action={href(`/contests/:contestId/shares`, { contestId })}
      {...getFormProps(form)}
      className='flex max-w-xl flex-col gap-4'
    >
      <TextField
        // A reset form's field has a new key
        key={fields.email.key}
        {...fieldProps(fields.email)}
        type='email'
        label='Colleague’s email address'
        description='The address they sign in with'
        autoComplete='off'
      />
      <div>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          Share contest
        </Button>
      </div>
      <FormError form={form} />
      <SavedNotice fetcher={fetcher} isFormValid={form.valid}>
        Shared the contest
      </SavedNotice>
    </fetcher.Form>
  )
}
