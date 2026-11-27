import { getFormProps } from '@conform-to/react'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { FormError } from './form-error.tsx'
import { SavedNotice } from './saved-notice.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { expectedLockDateSchema } from '~/bracket-admin-forms.ts'
import { listBattles } from '~/bracket.ts'
import type { BracketSummary, Phase } from '~/brackets.server.ts'
import { formatArizonaDate, toIsoDate } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'

const PHASE_LABELS: Record<Phase, string> = {
  SETUP: `Setup`,
  OPEN: `Open`,
  IN_PROGRESS: `In progress`,
  COMPLETE: `Complete`,
  ARCHIVED: `Archived`,
}

type ArchivedYear = { year: number; resultCount: number }

/**
 * The year's phase, the action that moves it to another, and the expected lock
 * date until it locks
 */
export const PhaseSection = ({
  year,
  summary,
  version = null,
  archivedYear = null,
  isOver = false,
}: {
  year: number
  summary: BracketSummary
  /** Of the bracket to publish, from `toBracketVersion` */
  version?: string | null
  /** The year that publishing this one archives */
  archivedYear?: ArchivedYear | null
  /** Whether the calendar has moved past the year's tournament */
  isOver?: boolean
}) => (
  <section className='flex max-w-3xl flex-col gap-3 border-2 border-ink p-5'>
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>Phase</h2>
      <PhaseTag phase={summary.phase} />
      {summary.phase === `OPEN` ? (
        <span className='text-muted'>
          Published {formatArizonaDate(summary.publishedAt)}
        </span>
      ) : null}
    </div>
    <p className='max-w-prose'>{describePhase(summary, isOver)}</p>
    {`expectedLockDate` in summary && !isOver ? (
      <ExpectedLockDateForm
        year={year}
        expectedLockDate={
          summary.expectedLockDate && toIsoDate(summary.expectedLockDate)
        }
      />
    ) : null}
    <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
      <PhaseAction
        year={year}
        summary={summary}
        version={version}
        archivedYear={archivedYear}
        isOver={isOver}
      />
    </div>
  </section>
)

const describePhase = (summary: BracketSummary, isOver: boolean): string => {
  switch (summary.phase) {
    case `SETUP`:
      return isOver
        ? `Only admins see this bracket. Its tournament is over, so it can’t be published.`
        : `Only admins see this bracket. Publish it once it matches ASU’s, so educators can create contests.`
    case `OPEN`:
      return `Educators can create contests, and players can submit. The first result locks submissions.`
    case `IN_PROGRESS`:
      return summary.hasResults
        ? `Submissions are locked. Results can be corrected until the next bracket is published.`
        : `Submissions are locked, though no results are saved.`
    case `COMPLETE`:
      return `${summary.champion} won, and ${describeResultCount(summary.resultCount)} saved. Results can be corrected until the next bracket is published.`
    case `ARCHIVED`:
      return `A newer bracket is published, so this one can’t change.`
  }
}

const describeResultCount = (count: number): string =>
  `${count} of ${listBattles().length} results are`

/** The action that moves the year to another phase, if any */
const PhaseAction = ({
  year,
  summary,
  version,
  archivedYear,
  isOver,
}: {
  year: number
  summary: BracketSummary
  version: string | null
  archivedYear: ArchivedYear | null
  isOver: boolean
}) => {
  switch (summary.phase) {
    case `SETUP`:
      return isOver ? null : (
        <PublishButton
          year={year}
          version={version}
          archivedYear={archivedYear}
        />
      )
    case `OPEN`:
      return <UnpublishControls year={year} hasContests={summary.hasContests} />
    case `IN_PROGRESS`:
      return summary.hasResults ? null : <ReopenButton year={year} />
    case `COMPLETE`:
    case `ARCHIVED`:
      return null
  }
}

const PublishButton = ({
  year,
  version,
  archivedYear,
}: {
  year: number
  version: string | null
  archivedYear: ArchivedYear | null
}) => (
  <ConfirmDialog
    trigger={<Button>{`Publish ${year} bracket`}</Button>}
    title={`Publish the ${year} bracket?`}
    confirmLabel={`Publish ${year} bracket`}
    confirmVariant='primary'
    action={href(`/admin/bracket/publication`)}
    fields={{
      year: String(year),
      published: `true`,
      seenVersion: version ?? ``,
    }}
  >
    <div className='flex flex-col gap-2'>
      <p>
        Educators can then create contests with it, and it becomes the current
        bracket on the home page.
      </p>
      {archivedYear === null ? null : (
        <p>
          {`${archivedYear.year} becomes read-only, and ${describeResultCount(archivedYear.resultCount)} saved. Everything in its trash, and every bracket its players never submitted, is deleted forever. Unpublishing doesn’t bring it back.`}
        </p>
      )}
      <p>
        This publishes the saved bracket, without unsaved changes in the form.
        After publishing, you can rename and move combatants. You can unpublish
        until an educator creates a contest.
      </p>
    </div>
  </ConfirmDialog>
)

const ReopenButton = ({ year }: { year: number }) => (
  <ConfirmDialog
    trigger={<Button variant='secondary'>Reopen submissions</Button>}
    title='Reopen submissions?'
    confirmLabel='Reopen submissions'
    confirmVariant='primary'
    action={href(`/admin/results/reopen`)}
    fields={{ year: String(year) }}
  >
    <p>
      Players can start, edit, and submit brackets again, and educators can
      create contests. A submission that lost picks when combatants moved
      returns to a draft. The next result locks submissions again.
    </p>
  </ConfirmDialog>
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
        action={href(`/admin/bracket/publication`)}
        fields={{ year: String(year), published: `false` }}
      >
        <p>
          Educators can’t create contests with it until you publish it again,
          and the previous bracket, if any, becomes the current one on the home
          page.
        </p>
      </ConfirmDialog>
      <span className='text-muted'>
        Possible until an educator creates a contest
      </span>
    </>
  )

export const PhaseTag = ({ phase }: { phase: Phase }) => (
  <span
    className={`border-2 border-accent-strong px-2 font-condensed text-sm font-bold tracking-wider uppercase ${phase === `OPEN` || phase === `IN_PROGRESS` ? `bg-accent-strong text-white` : `text-accent-strong`}`}
  >
    {PHASE_LABELS[phase]}
  </span>
)

const ExpectedLockDateForm = ({
  year,
  expectedLockDate,
}: {
  year: number
  expectedLockDate: string | null
}) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    expectedLockDateSchema,
    fetcher.data?.result,
    { year, expectedLockDate: expectedLockDate ?? undefined },
  )
  return (
    <fetcher.Form
      method='post'
      action={href(`/admin/bracket/expected-lock-date`)}
      {...getFormProps(form)}
      className='flex flex-col gap-2'
    >
      <input type='hidden' name={fields.year.name} value={year} />
      <div className='max-w-md'>
        <TextField
          {...fieldProps(fields.expectedLockDate)}
          type='date'
          label='Expected lock date'
          description='Optional. Educators and players see it as a heads-up'
        >
          <Button
            type='submit'
            variant='secondary'
            isPending={fetcher.state !== `idle`}
          >
            <span className='whitespace-nowrap'>Save date</span>
          </Button>
        </TextField>
      </div>
      <SavedNotice fetcher={fetcher} isFormValid={form.valid}>
        Saved the expected lock date
      </SavedNotice>
      <FormError form={form} />
    </fetcher.Form>
  )
}
