import {
  FormProvider,
  getFormProps,
  useField,
  useFormMetadata,
} from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { useState } from 'react'
import {
  Button as AriaButton,
  TextField as AriaTextField,
  Disclosure,
  DisclosurePanel,
  FieldError,
  Heading,
  Label,
  RadioButton,
  RadioField,
  RadioGroup,
  TextArea,
} from 'react-aria-components'
import { Form } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { ErrorSummary } from './error-summary.tsx'
import { FormError } from './form-error.tsx'
import { SelectField } from './select-field.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import {
  bracketFormSchema,
  countCombatantPlaces,
  POSITION_LABELS,
  readDivisionNameField,
  readFieldName,
  readPastedNames,
} from '~/bracket-form.ts'
import type { BracketForm, WildCardChoice } from '~/bracket-form.ts'
import {
  DIVISION_POSITIONS,
  isSameSeedSlot,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  ROUND_NAMES,
  SEEDS,
} from '~/bracket.ts'
import type { DivisionPosition } from '~/bracket.ts'

// ASU's wild card usually fills seed 16 with two entrants
const DEFAULT_WILD_CARD: WildCardChoice = {
  position: `TOP_LEFT`,
  seed: 16,
  entrantCount: 2,
}

// The left divisions, then the right ones
const DIVISION_COLUMNS = [
  DIVISION_POSITIONS.slice(0, 2),
  DIVISION_POSITIONS.slice(2),
]

const ENTRANT_COUNTS = Array.from(
  { length: MAX_WILD_CARD_ENTRANTS - MIN_WILD_CARD_ENTRANTS + 1 },
  (_, index) => MIN_WILD_CARD_ENTRANTS + index,
)

// Creates or edits the year's unpublished bracket. The wild card's choices
// decide which seed holds its entrants, so they come first
export const BracketSetupForm = ({
  year,
  defaultValue,
  lastResult,
}: {
  year: number
  // An existing bracket to edit
  defaultValue?: BracketForm
  lastResult?: SubmissionResult
}) => {
  const { form, isSubmitting } = useValidatedForm(
    bracketFormSchema,
    lastResult,
    defaultValue,
  )
  const [wildCard, setWildCard] = useState<WildCardChoice>(
    defaultValue?.wildCard ?? DEFAULT_WILD_CARD,
  )
  const isEdit = defaultValue !== undefined

  return (
    <FormProvider context={form.context}>
      <div className='flex flex-col gap-8'>
        <FormErrorSummary />
        <p className='max-w-prose'>
          Enter the combatants from ASU’s bracket. Only admins see it until you
          publish it.
        </p>
        <Form
          method='post'
          {...getFormProps(form)}
          className='flex flex-col gap-8'
        >
          <WildCardSection wildCard={wildCard} onChange={setWildCard} />
          <PasteSection
            wildCard={wildCard}
            onPaste={names => {
              for (const [name, value] of names) {
                form.update({ name, value })
              }
            }}
          />
          <section className='flex flex-col gap-4'>
            <h2 className={SECTION_HEADING_CLASS_NAME}>Divisions</h2>
            {/* Left divisions in the first column and right ones in the
                second, as on the diagram. The reading order stays the paste
                order */}
            <div className='grid items-start gap-6 lg:grid-cols-2'>
              {DIVISION_COLUMNS.map(column => (
                <div key={column[0]} className='flex flex-col gap-6'>
                  {column.map(position => (
                    <DivisionFields
                      key={position}
                      position={position}
                      wildCard={wildCard}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
          <div className='flex flex-col items-start gap-3'>
            <Button type='submit' isPending={isSubmitting}>
              {isEdit ? `Save changes` : `Save bracket`}
            </Button>
            <FormError form={form} />
          </div>
        </Form>
        {isEdit ? <DeleteSection year={year} /> : null}
      </div>
    </FormProvider>
  )
}

// Reads the errors from the form's context, so only the summary re-renders as
// they change. Field errors arrive in the order the form shows the fields
const FormErrorSummary = () => {
  const { allErrors } = useFormMetadata()
  return (
    <ErrorSummary
      errors={Object.entries(allErrors)
        .filter(([name]) => name !== ``)
        .flatMap(([name, messages]) =>
          messages.map(message => ({ name, message })),
        )}
    />
  )
}

const WildCardSection = ({
  wildCard,
  onChange,
}: {
  wildCard: WildCardChoice
  onChange: (wildCard: WildCardChoice) => void
}) => {
  const divisionNames = useDivisionNames()
  return (
    <section className='flex flex-col gap-4'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>{ROUND_NAMES.WILD_CARD}</h2>
      <p className='max-w-prose text-muted'>
        The wild card’s winner fills one seed in Round 1. Its entrants appear at
        that seed below.
      </p>
      <div className='grid max-w-3xl gap-4 sm:grid-cols-[2fr_1fr_1.4fr]'>
        <SelectField
          label='Division'
          name='wildCard.position'
          value={wildCard.position}
          onChange={position => onChange({ ...wildCard, position })}
          options={DIVISION_POSITIONS.map(position => ({
            id: position,
            label: divisionNames[position]
              ? `${capitalize(POSITION_LABELS[position])}: ${divisionNames[position]}`
              : capitalize(POSITION_LABELS[position]),
          }))}
        />
        <SelectField
          label='Seed'
          name='wildCard.seed'
          value={wildCard.seed}
          onChange={seed => onChange({ ...wildCard, seed })}
          options={SEEDS.map(seed => ({ id: seed, label: String(seed) }))}
        />
        <RadioGroup
          name='wildCard.entrantCount'
          orientation='horizontal'
          value={String(wildCard.entrantCount)}
          onChange={count =>
            onChange({ ...wildCard, entrantCount: Number(count) })
          }
          className='flex flex-col gap-1'
        >
          <Label className='font-semibold'>Entrants</Label>
          <div className='flex gap-2'>
            {ENTRANT_COUNTS.map(count => (
              <RadioField key={count} value={String(count)}>
                <RadioButton className='flex min-h-11 min-w-13 cursor-pointer items-center justify-center border-2 border-ink font-condensed text-lg font-bold outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong data-selected:bg-ink data-selected:text-white'>
                  {count}
                </RadioButton>
              </RadioField>
            ))}
          </div>
        </RadioGroup>
      </div>
    </section>
  )
}

const useDivisionNames = (): Record<DivisionPosition, string> => {
  const [divisions] = useField<BracketForm[`divisions`]>(`divisions`)
  return Object.fromEntries(
    DIVISION_POSITIONS.map(position => [
      position,
      divisions.value?.[position]?.name?.trim() ?? ``,
    ]),
  ) as Record<DivisionPosition, string>
}

const capitalize = (text: string): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`

const PasteSection = ({
  wildCard,
  onPaste,
}: {
  wildCard: WildCardChoice
  onPaste: (names: [string, string][]) => void
}) => {
  const [text, setText] = useState(``)
  const [error, setError] = useState<string>()
  const expectedCount = countCombatantPlaces(wildCard)
  return (
    <Disclosure className='flex max-w-3xl flex-col border-2 border-ink'>
      <Heading>
        <AriaButton
          slot='trigger'
          className='flex w-full cursor-pointer items-center gap-2 p-4 text-start font-condensed text-xl font-extrabold uppercase outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong'
        >
          <span aria-hidden className='in-aria-expanded:rotate-90'>
            ▸
          </span>
          Paste names
        </AriaButton>
      </Heading>
      <DisclosurePanel className='flex flex-col gap-3 px-4 pb-4'>
        <p className='text-muted'>
          One name per line, in seed order: top left, bottom left, top right,
          then bottom right. Skip the wild card’s seed and put its entrants
          last. That makes {expectedCount} names.
        </p>
        <AriaTextField
          value={text}
          onChange={value => {
            setText(value)
            setError(undefined)
          }}
          isInvalid={error !== undefined}
          validationBehavior='aria'
          className='flex flex-col gap-1'
        >
          <Label className='font-semibold'>Names</Label>
          <TextArea
            rows={8}
            className='min-w-0 border-2 border-ink px-3 py-2 data-invalid:border-danger'
          />
          <FieldError className='font-semibold text-danger'>{error}</FieldError>
        </AriaTextField>
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
          <Button
            variant='secondary'
            onPress={() => {
              const result = readPastedNames(text, wildCard)
              if (`error` in result) {
                setError(result.error)
              } else {
                onPaste(result.fields)
              }
            }}
          >
            Fill in the fields
          </Button>
          <span className='text-muted'>Replaces every name below</span>
        </div>
      </DisclosurePanel>
    </Disclosure>
  )
}

const DivisionFields = ({
  position,
  wildCard,
}: {
  position: DivisionPosition
  wildCard: WildCardChoice
}) => (
  <fieldset className='flex min-w-0 flex-col gap-4 border-2 border-ink px-5 pt-4 pb-5'>
    <legend className='px-1.5 font-condensed text-xl font-extrabold uppercase'>
      {POSITION_LABELS[position]}
    </legend>
    <NameField name={readDivisionNameField(position)} label='Division name' />
    {/* Seeds 1 to 8 in the first column and 9 to 16 in the second. Each
        column sizes its own rows, so the wild card's entrants stretch only
        theirs */}
    <div className='grid items-start gap-x-4 gap-y-2 sm:grid-cols-2'>
      {[SEEDS.slice(0, 8), SEEDS.slice(8)].map(seeds => (
        <ol key={seeds[0]} start={seeds[0]} className='flex flex-col gap-2'>
          {seeds.map(seed => (
            <li
              key={seed}
              className='grid grid-cols-[2rem_minmax(0,1fr)] gap-2'
            >
              <span
                aria-hidden
                className='text-end font-condensed text-lg leading-11 font-bold text-muted tabular-nums'
              >
                {seed}
              </span>
              {isSameSeedSlot({ position, seed }, wildCard) ? (
                <WildCardEntrants entrantCount={wildCard.entrantCount} />
              ) : (
                <NameField
                  name={readFieldName({
                    kind: `seedSlot`,
                    seedSlot: { position, seed },
                  })}
                  label={`Seed ${seed}`}
                  hideLabel
                />
              )}
            </li>
          ))}
        </ol>
      ))}
    </div>
  </fieldset>
)

const WildCardEntrants = ({ entrantCount }: { entrantCount: number }) => (
  <div className='flex flex-col gap-2 border-s-4 border-accent ps-2.5'>
    <span className='font-condensed text-sm font-bold tracking-wider text-accent-strong uppercase'>
      {ROUND_NAMES.WILD_CARD}
    </span>
    {Array.from({ length: entrantCount }, (_, index) => (
      <NameField
        key={index}
        name={readFieldName({ kind: `entrant`, index })}
        label={`Entrant ${index + 1}`}
      />
    ))}
  </div>
)

// A name field tied to the form by `name`. A hidden label still names the
// field for screen readers. A pasted name replaces the field through its key
const NameField = ({
  name,
  label,
  hideLabel = false,
}: {
  name: string
  label: string
  hideLabel?: boolean
}) => {
  const [field] = useField<string>(name)
  return (
    <TextField
      key={field.key}
      {...fieldProps(field)}
      label={label}
      hideLabel={hideLabel}
    />
  )
}

const DeleteSection = ({ year }: { year: number }) => (
  <section className='flex flex-col gap-4 border-t-2 border-ink pt-7'>
    <h2 className={SECTION_HEADING_CLASS_NAME}>Delete bracket</h2>
    <p className='max-w-prose text-muted'>
      Only an unpublished bracket can be deleted. You’d enter every name again.
    </p>
    <div>
      <ConfirmDialog
        trigger={<Button variant='danger'>{`Delete ${year} bracket`}</Button>}
        title={`Delete the ${year} bracket?`}
        confirmLabel={`Delete ${year} bracket`}
        action='/admin/bracket/delete'
      >
        <p>
          This deletes its divisions, combatants, and wild card. Nobody else has
          seen it yet, since it’s unpublished.
        </p>
      </ConfirmDialog>
    </div>
  </section>
)
