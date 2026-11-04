import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form } from 'react-router'
import { Button, ButtonLink } from './button.tsx'
import { FormError } from './form-error.tsx'
import { PAGE_LABEL_CLASS_NAME } from './page-header.tsx'
import { PageTitle } from './page-title.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { ContestByLink } from '~/contests.server.ts'
import { freeTextSchema } from '~/free-text.ts'
import { displayNameSchema } from '~/player-forms.ts'

type PlayContest = Omit<ContestByLink, `id`>

// What the contest link shows: the name question, the prompt for a player
// this browser remembers, or that the contest no longer takes players
export type PlayView =
  | { state: `askName` }
  | { state: `returning`; displayName: string; bracketPath: string }
  | { state: `closed` }

export const CONTEST_CLOSED = `This contest’s year is over, so it takes no new players`

export const PlayContestPage = ({
  view,
  lastResult,
}: {
  view: PlayView
  lastResult?: SubmissionResult
}) =>
  view.state === `askName` ? (
    <NameForm lastResult={lastResult} />
  ) : view.state === `returning` ? (
    <ReturningPlayer {...view} />
  ) : (
    <ContestClosed />
  )

export const ContestContext = ({ contest }: { contest: PlayContest }) => (
  <div className='flex flex-col items-start gap-2'>
    <p className='bg-ink px-2 py-0.5 font-condensed font-bold tracking-widest text-white uppercase'>
      {`March Mammal Madness ${contest.yearId}`}
    </p>
    <p className={PAGE_LABEL_CLASS_NAME}>
      {`${contest.name} · ${contest.educatorName}’s contest`}
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
  displayName,
  bracketPath,
}: {
  displayName: string
  bracketPath: string
}) => (
  <div className='flex flex-col gap-4'>
    <PageTitle>{`Continue as ${displayName}?`}</PageTitle>
    <p>{`This computer has ${displayName}’s bracket for this contest.`}</p>
    <Form method='post' className='flex flex-wrap gap-3'>
      <ButtonLink href={bracketPath}>{`Continue as ${displayName}`}</ButtonLink>
      <Button type='submit' name='intent' value='not-you' variant='secondary'>
        Not you? Start a new bracket
      </Button>
    </Form>
  </div>
)

const ContestClosed = () => (
  <div className='flex flex-col gap-3'>
    <PageTitle>New brackets are closed</PageTitle>
    <p>{`${CONTEST_CLOSED}.`}</p>
  </div>
)
