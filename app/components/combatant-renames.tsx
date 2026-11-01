import { getFormProps } from '@conform-to/react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import type { SavedResult } from './saved-notice.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import { renameSchema } from '~/bracket-admin-forms.ts'
import { POSITION_LABELS } from '~/bracket-form.ts'
import { ROUND_NAMES } from '~/bracket.ts'
import type { DivisionPosition } from '~/bracket.ts'
import type { CombatantRow } from '~/brackets.server.ts'

type DivisionCombatants = {
  position: DivisionPosition
  name: string
  combatants: CombatantRow[]
}

// Renames a published bracket's combatants, one row at a time
export const CombatantRenames = ({
  divisions,
}: {
  divisions: DivisionCombatants[]
}) => {
  const [editingId, setEditingId] = useState<string>()
  return (
    <section className='flex flex-col gap-4'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>Combatants</h2>
      <p className='max-w-prose text-muted'>
        Rename a combatant to fix a typo or match ASU’s spelling. Every bracket
        shows the new name.
      </p>
      <div className='grid items-start gap-6 lg:grid-cols-2'>
        {divisions.map(({ position, name, combatants }) => (
          <fieldset
            key={position}
            className='flex min-w-0 flex-col border-2 border-ink px-5 pt-3 pb-4'
          >
            <legend className='px-1.5 font-condensed text-xl font-extrabold uppercase'>
              {POSITION_LABELS[position]}: {name}
            </legend>
            <ol>
              {combatants.map(combatant => (
                <RenameRow
                  key={combatant.id}
                  combatant={combatant}
                  isEditing={combatant.id === editingId}
                  onEdit={() => setEditingId(combatant.id)}
                  onDone={() => setEditingId(undefined)}
                />
              ))}
            </ol>
          </fieldset>
        ))}
      </div>
    </section>
  )
}

// The row's editor closes once its save succeeds, and Rename opens it afresh
const RenameRow = ({
  combatant,
  isEditing,
  onEdit,
  onDone,
}: {
  combatant: CombatantRow
  isEditing: boolean
  onEdit: () => void
  onDone: () => void
}) => {
  const fetcher = useFetcher<SavedResult>()
  const isSaved = fetcher.state === `idle` && fetcher.data?.saved === true
  const startEditing = () => {
    fetcher.reset()
    onEdit()
  }

  const seedCell = (
    <span className='text-end font-condensed text-lg font-bold text-muted tabular-nums'>
      {combatant.seed}
    </span>
  )
  if (!isEditing || isSaved) {
    return (
      <li className='grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-muted-light last:border-b-0'>
        {seedCell}
        <span className='min-w-0'>
          {combatant.name}
          {combatant.isWildCardEntrant ? (
            <span className='ms-2 font-condensed text-sm font-bold tracking-wider text-accent-strong uppercase'>
              {ROUND_NAMES.WILD_CARD}
            </span>
          ) : null}
        </span>
        <Button
          variant='quiet'
          onPress={startEditing}
          aria-label={`Rename ${combatant.name}`}
        >
          Rename
        </Button>
      </li>
    )
  }
  return (
    <li className='grid grid-cols-[2rem_minmax(0,1fr)] gap-2 border-b border-muted-light py-2 last:border-b-0'>
      {seedCell}
      <RenameForm combatant={combatant} fetcher={fetcher} onCancel={onDone} />
    </li>
  )
}

const RenameForm = ({
  combatant: { id, name },
  fetcher,
  onCancel,
}: {
  combatant: CombatantRow
  fetcher: FetcherWithComponents<SavedResult>
  onCancel: () => void
}) => {
  const { form, fields } = useValidatedForm(
    renameSchema,
    fetcher.data?.result,
    { name },
  )
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === `Escape`) {
      onCancel()
    }
  }
  return (
    <fetcher.Form
      method='post'
      action='/admin/bracket/rename'
      {...getFormProps(form)}
      onKeyDown={cancelOnEscape}
      className='flex flex-col gap-2'
    >
      <input type='hidden' name={fields.combatantId.name} value={id} />
      <TextField
        {...fieldProps(fields.name)}
        label={`New name for ${name}`}
        // The row opens for typing, as a Rename press asks
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className='flex gap-2'>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          Save
        </Button>
        <Button variant='secondary' onPress={onCancel}>
          Cancel
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
