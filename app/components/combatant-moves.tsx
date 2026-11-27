import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { FetcherError } from './fetcher-error.tsx'
import { Notice } from './notice.tsx'
import { SelectField } from './select-field.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { useIsLatestAction } from './use-is-latest-action.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'
import type { MoveImpact, MoveReply } from '~/moves.server.ts'
import { listPlaces, readArrangement, swapCombatants } from '~/moves.ts'
import type { Place, Swap } from '~/moves.ts'
import type { StoredBracket } from '~/seeded-bracket.ts'

/**
 * Swaps a published bracket's combatants. The swaps add up until the admin
 * reviews them, so picks are cleared once for all of them
 */
export const CombatantMoves = ({
  year,
  bracket,
  isLocked,
}: {
  year: number
  bracket: StoredBracket
  isLocked: boolean
}) => {
  const arrangement = readArrangement(bracket)
  // Swaps of an arrangement that has changed no longer mean what they did
  const [pending, setPending] = useState({ arrangement, swaps: NO_SWAPS })
  const preview = useFetcher<MoveReply>()
  const save = useFetcher<ConfirmResult>()
  const [submitted, setSubmitted] = useState<Submitted>(NOTHING_SUBMITTED)
  const isLatest = useIsLatestAction(save)
  const isSaved = Boolean(save.data && `ok` in save.data)
  // Saved swaps that cancel out leave the arrangement as it was
  const swaps =
    pending.arrangement === arrangement &&
    !(isSaved && pending.swaps === submitted.swaps)
      ? pending.swaps
      : NO_SWAPS
  const clearSaved = () => {
    // Resetting a save under way would drop its reply and the reload after it
    if (save.state === `idle`) {
      save.reset()
    }
  }
  const changeSwaps = (next: Swap[]) => {
    // A review under way would show what the earlier swaps clear
    preview.reset()
    clearSaved()
    setPending({ arrangement, swaps: next })
  }
  const move = { year, arrangement, isLocked, swaps }
  const target = {
    method: `post`,
    action: href(`/admin/bracket/move`),
    encType: `application/json`,
  } as const
  // Previewing reloads the page, which drops swaps of a changed arrangement
  const impact =
    swaps.length > 0 &&
    preview.state === `idle` &&
    preview.data &&
    `impact` in preview.data
      ? preview.data.impact
      : null
  return (
    <section className='flex flex-col gap-4'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>Move combatants</h2>
      <p className='max-w-prose text-muted'>
        Swap two combatants that ASU’s bracket has in each other’s place.
        Nothing changes until you review the swaps and confirm.
      </p>
      <SwapForm
        places={listPlaces(swapCombatants(bracket, swaps)!)}
        onSwap={swap => changeSwaps([...swaps, swap])}
      />
      {swaps.length > 0 ? (
        <>
          <SwapList bracket={bracket} swaps={swaps} onChange={changeSwaps} />
          <div>
            <Button
              isPending={preview.state !== `idle` || save.state !== `idle`}
              onPress={() => {
                clearSaved()
                void preview.submit(
                  { ...move, intent: `preview`, results: [] },
                  target,
                )
              }}
            >
              {`Review ${formatCount(swaps.length, `swap`)}`}
            </Button>
          </div>
        </>
      ) : null}
      <FetcherError fetcher={preview} />
      <FetcherError fetcher={save} />
      {isSaved && isLatest ? (
        <Notice kind='status'>
          {submitted.isMove
            ? `Moved the combatants`
            : `The swaps canceled out, so no combatant moved`}
        </Notice>
      ) : null}
      {impact ? (
        <ConfirmDialog
          isOpen
          onOpenChange={() => preview.reset()}
          title='Move combatants?'
          confirmLabel='Move combatants'
          onConfirm={() => {
            setSubmitted({
              swaps,
              isMove: listMoves(bracket, swaps).length > 0,
            })
            return save.submit(
              { ...move, intent: `save`, results: impact.results },
              target,
            )
          }}
        >
          <MoveDescription
            moves={listMoves(bracket, swaps)}
            impact={impact}
            isLocked={isLocked}
          />
        </ConfirmDialog>
      ) : null}
    </section>
  )
}

const NO_SWAPS: Swap[] = []

/** `isMove` is false for swaps that cancel out */
type Submitted = { swaps: Swap[]; isMove: boolean }

const NOTHING_SUBMITTED: Submitted = { swaps: NO_SWAPS, isMove: false }

const SwapForm = ({
  places,
  onSwap,
}: {
  places: Place[]
  onSwap: (swap: Swap) => void
}) => {
  const [firstId, setFirstId] = useState(places[0]!.combatant.id)
  const [secondId, setSecondId] = useState(places[1]!.combatant.id)
  const options = places.map(({ label, combatant: { id, name } }) => ({
    id,
    label: `${label}: ${name}`,
  }))
  return (
    <div className='flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end'>
      <div className='min-w-0 flex-1'>
        <SelectField
          label='Swap'
          name='first'
          options={options}
          value={firstId}
          onChange={setFirstId}
        />
      </div>
      <div className='min-w-0 flex-1'>
        <SelectField
          label='With'
          name='second'
          options={options}
          value={secondId}
          onChange={setSecondId}
        />
      </div>
      <Button
        variant='secondary'
        isDisabled={firstId === secondId}
        onPress={() => onSwap([firstId, secondId])}
      >
        Add swap
      </Button>
    </div>
  )
}

const SwapList = ({
  bracket,
  swaps,
  onChange,
}: {
  bracket: StoredBracket
  swaps: Swap[]
  onChange: (swaps: Swap[]) => void
}) => {
  const nameById = new Map(
    listPlaces(bracket).map(({ combatant: { id, name } }) => [id, name]),
  )
  return (
    <ol className='max-w-3xl'>
      {swaps.map(([first, second], index) => {
        const label = `${nameById.get(first)} and ${nameById.get(second)}`
        return (
          <li
            // A swap has no identity of its own, and rows never reorder
            key={index}
            className='flex min-h-11 items-center justify-between gap-3 border-b border-muted-light'
          >
            {label}
            <Button
              variant='quiet'
              aria-label={`Remove the swap of ${label}`}
              onPress={() => onChange(swaps.toSpliced(index, 1))}
            >
              Remove
            </Button>
          </li>
        )
      })}
    </ol>
  )
}

/** Such as "Polar Bear to Tuxedo Style 8", for each combatant that moves */
const listMoves = (bracket: StoredBracket, swaps: Swap[]): string[] => {
  const formerIds = listPlaces(bracket).map(({ combatant }) => combatant.id)
  return listPlaces(swapCombatants(bracket, swaps)!).flatMap(
    ({ label, combatant: { id, name } }, index) =>
      id === formerIds[index] ? [] : `${name} to ${label}`,
  )
}

const MoveDescription = ({
  moves,
  impact: { battles, submissions, drafts, results },
  isLocked,
}: {
  moves: string[]
  impact: MoveImpact
  isLocked: boolean
}) => {
  const effect = isLocked
    ? describeLockedImpact(submissions)
    : describeOpenImpact(submissions, drafts)
  return (
    <div className='flex flex-col gap-2'>
      {moves.length === 0 ? (
        <p>The swaps cancel out, so no combatant moves.</p>
      ) : (
        <ul className='max-h-48 list-disc overflow-y-auto ps-5'>
          {moves.map(move => (
            <li key={move}>{move}</li>
          ))}
        </ul>
      )}
      {battles === 0 ? (
        <p>The same combatants meet in every battle, so nothing is cleared.</p>
      ) : (
        <>
          <p>
            {`This clears the picks of ${formatCount(battles, `battle`)}: those where different combatants would meet, and the later ones they lead to.`}
          </p>
          {effect === null ? null : <p>{effect}</p>}
          {results.length > 0 ? (
            <p>{`It also clears ${formatCount(results.length, `result`)}, to record again.`}</p>
          ) : null}
          <p>Moving them back won’t restore what’s cleared.</p>
        </>
      )}
    </div>
  )
}

/** Null when the counts, which leave out the trash, are 0 */
const describeLockedImpact = (submissions: number): string | null =>
  submissions === 0
    ? null
    : `Submissions are locked, so those picks in ${formatCount(submissions, `submission`)} score nothing.`

/** Null when the counts, which leave out the trash, are 0 */
const describeOpenImpact = (
  submissions: number,
  drafts: number,
): string | null => {
  const effects = [
    submissions === 1
      ? `1 submission returns to a draft`
      : `${submissions} submissions return to drafts`,
    drafts === 1 ? `1 draft loses picks` : `${drafts} drafts lose picks`,
  ].filter((_, index) => [submissions, drafts][index]! > 0)
  return effects.length === 0
    ? null
    : `${effects.join(`, and `)}. Those players see a note to finish and submit.`
}
