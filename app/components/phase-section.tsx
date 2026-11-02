import { getFormProps } from '@conform-to/react'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { FormError } from './form-error.tsx'
import { SavedNotice } from './saved-notice.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { expectedLockDateSchema } from '~/bracket-admin-forms.ts'
import type { BracketSummary, Phase } from '~/brackets.server.ts'
import { formatArizonaDate, toIsoDate } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'

const PHASE_LABELS: Record<Phase, string> = { SETUP: `Setup`, OPEN: `Open` }

// The year's phase, the one action that moves it on, and the expected lock
// date
export const PhaseSection = ({
  year,
  summary,
}: {
  year: number
  summary: BracketSummary
}) => (
  <section className='flex max-w-3xl flex-col gap-3 border-2 border-ink p-5'>
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>Status</h2>
      <PhaseTag phase={summary.phase} />
      {summary.phase === `OPEN` ? (
        <span className='text-muted'>
          Published {formatArizonaDate(summary.publishedAt)}
        </span>
      ) : null}
    </div>
    <p className='max-w-prose'>
      {summary.phase === `OPEN`
        ? `Educators can create contests with this bracket, and it’s the current bracket on the home page. Only combatant names can change now.`
        : `Only admins see this bracket. Publish it once it matches ASU’s, so educators can create contests.`}
    </p>
    <ExpectedLockDateForm
      expectedLockDate={
        summary.expectedLockDate && toIsoDate(summary.expectedLockDate)
      }
    />
    <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
      {summary.phase === `OPEN` ? (
        <UnpublishControls year={year} hasContests={summary.hasContests} />
      ) : (
        <ConfirmDialog
          trigger={<Button>{`Publish ${year} bracket`}</Button>}
          title={`Publish the ${year} bracket?`}
          confirmLabel={`Publish ${year} bracket`}
          confirmVariant='primary'
          action='/admin/bracket/publication'
          fields={{ published: `true` }}
        >
          <div className='flex flex-col gap-2'>
            <p>
              Educators can then create contests with it, and it becomes the
              current bracket on the home page.
            </p>
            <p>
              After publishing, only combatant names can change. You can
              unpublish until an educator creates a contest.
            </p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  </section>
)

const UnpublishControls = ({
  year,
  hasContests,
}: {
  year: number
  hasContests: boolean
}) =>
  hasContests ? (
    <p className='text-muted'>
      Educators have created contests, so the bracket stays published.
    </p>
  ) : (
    <>
      <ConfirmDialog
        trigger={<Button variant='secondary'>Unpublish</Button>}
        title={`Unpublish the ${year} bracket?`}
        confirmLabel={`Unpublish ${year} bracket`}
        action='/admin/bracket/publication'
        fields={{ published: `false` }}
      >
        <p>
          Educators can’t create contests with it until you publish it again,
          and the previous bracket becomes the current one on the home page.
        </p>
      </ConfirmDialog>
      <span className='text-muted'>
        Possible until an educator creates a contest
      </span>
    </>
  )

export const PhaseTag = ({ phase }: { phase: Phase }) => (
  <span
    className={`border-2 border-accent-strong px-2 font-condensed text-sm font-bold tracking-wider uppercase ${phase === `OPEN` ? `bg-accent-strong text-white` : `text-accent-strong`}`}
  >
    {PHASE_LABELS[phase]}
  </span>
)

const ExpectedLockDateForm = ({
  expectedLockDate,
}: {
  expectedLockDate: string | null
}) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    expectedLockDateSchema,
    fetcher.data?.result,
    { expectedLockDate: expectedLockDate ?? undefined },
  )
  return (
    <fetcher.Form
      method='post'
      action='/admin/bracket/expected-lock-date'
      {...getFormProps(form)}
      className='flex flex-col gap-2'
    >
      <div className='flex flex-wrap items-start gap-x-3 gap-y-2'>
        <div className='w-72'>
          <TextField
            {...fieldProps(fields.expectedLockDate)}
            type='date'
            label='Expected lock date'
            description='Optional. Educators and players see it as a heads-up'
          />
        </div>
        <div className='sm:mt-14'>
          <Button
            type='submit'
            variant='secondary'
            isPending={fetcher.state !== `idle`}
          >
            Save date
          </Button>
        </div>
      </div>
      <SavedNotice fetcher={fetcher} isFormValid={form.valid}>
        Saved the expected lock date
      </SavedNotice>
      <FormError form={form} />
    </fetcher.Form>
  )
}
