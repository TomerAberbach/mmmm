import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, Outlet } from 'react-router'
import { Button, ButtonLink } from './button.tsx'
import { FormError } from './form-error.tsx'
import { PAGE_LABEL_CLASS_NAME } from './page-header.tsx'
import { PageTitle } from './page-title.tsx'
import { ReportDialog } from './report-dialog.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { PlayContest } from '~/contests.server.ts'
import { freeTextSchema } from '~/free-text.ts'
import { displayNameSchema } from '~/player-forms.ts'
import { CONTEST_TARGET } from '~/report-forms.ts'

/**
 * What the contest link shows: the name question, the prompt for a player
 * this browser remembers, or that the contest takes no players
 */
export type PlayView =
  | { state: `askName` }
  | {
      state: `returning`
      displayName: string
      bracketPath: string
      /** Whether the contest takes new players */
      isOpen: boolean
    }
  | { state: `notOpen` }
  | { state: `orphaned` }

export const ORPHANED_MESSAGE = `This contest’s educator left MMMM, so no one can start a bracket`

export const NOT_OPEN_MESSAGE = `Submissions are closed, so no one can start a bracket`

export const PlayContestPage = ({
  view,
  reportPath,
  lastResult,
}: {
  view: PlayView
  reportPath: string
  lastResult?: SubmissionResult
}) => (
  <div className='flex flex-col gap-8'>
    {view.state === `askName` ? (
      <NameForm lastResult={lastResult} />
    ) : view.state === `returning` ? (
      <ReturningPlayer view={view} />
    ) : view.state === `orphaned` ? (
      <OrphanedContest />
    ) : (
      <ContestNotOpen />
    )}
    <ReportDialog action={reportPath} targets={[CONTEST_TARGET]} />
  </div>
)

/**
 * Pages under a contest, which search engines skip, since their addresses open a
 * contest or a player's bracket
 */
export const PlayLayout = ({ contest }: { contest: PlayContest }) => (
  <div className='flex flex-col gap-6'>
    <meta name='robots' content='noindex' />
    <ContestContext contest={contest} />
    <Outlet />
  </div>
)

export const ContestContext = ({ contest }: { contest: PlayContest }) => (
  <div className='flex flex-col items-start gap-2'>
    <p className='bg-ink px-2 py-0.5 font-condensed font-bold tracking-widest text-white uppercase print:px-0 print:text-black'>
      {`March Mammal Madness ${contest.year}`}
    </p>
    <p className={PAGE_LABEL_CLASS_NAME}>
      {`${contest.name} · ${contest.educatorName ?? `A former educator`}’s contest`}
    </p>
  </div>
)

const NAME_QUESTION = `What’s your first name and last initial?`

const DISPLAY_NAME_SCHEMA = displayNameSchema(freeTextSchema)

const NameForm = ({ lastResult }: { lastResult?: SubmissionResult }) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    DISPLAY_NAME_SCHEMA,
    lastResult,
  )
  return (
    <Form method='post' {...getFormProps(form)} className='flex flex-col gap-5'>
      <PageTitle>{NAME_QUESTION}</PageTitle>
      <TextField
        {...fieldProps(fields.displayName)}
        label={NAME_QUESTION}
        hideLabel
        description='For example, Maya R. Your educator sees it, and other players may see it on leaderboards'
        // A shared computer would suggest the last player's name
        autoComplete='off'
        spellCheck='false'
      />
      <div>
        <Button type='submit' isPending={isSubmitting}>
          Start my bracket
        </Button>
      </div>
      <FormError form={form} />
    </Form>
  )
}

const ReturningPlayer = ({
  view: { displayName, bracketPath, isOpen },
}: {
  view: Extract<PlayView, { state: `returning` }>
}) => (
  <div className='flex flex-col gap-4'>
    <PageTitle>{`Continue as ${displayName}?`}</PageTitle>
    <p>{`This computer has ${displayName}’s bracket for this contest.`}</p>
    <Form method='post' className='flex flex-wrap gap-3'>
      <ButtonLink href={bracketPath}>{`Continue as ${displayName}`}</ButtonLink>
      <Button type='submit' name='intent' value='not-you' variant='secondary'>
        {isOpen ? `Not you? Start a new bracket` : `Not you?`}
      </Button>
    </Form>
  </div>
)

const ContestNotOpen = () => (
  <div className='flex flex-col gap-3'>
    <PageTitle>Submissions are closed</PageTitle>
    <p>
      The first result is in, so no one can start a bracket. If you already have
      one, open your personal link.
    </p>
  </div>
)

const OrphanedContest = () => (
  <div className='flex flex-col gap-3'>
    <PageTitle>This contest takes no new players</PageTitle>
    <p>
      Its educator left MMMM. If you already have a bracket, open your personal
      link.
    </p>
  </div>
)
