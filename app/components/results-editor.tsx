import { useCallback, useMemo, useState } from 'react'
import { href, useRevalidator } from 'react-router'
import { Bracket } from './bracket.tsx'
import { Button } from './button.tsx'
import { ClearedNotice } from './cleared-notice.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { listMergeable, MergeDialog } from './merge-dialog.tsx'
import { PickingContext } from './picking.ts'
import type { Picking } from './picking.ts'
import { useRequestQueue } from './request-queue.ts'
import type { RequestState } from './request-queue.ts'
import { RequestAlert, RequestNote } from './request-status.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { useShownRound } from './shown-round.ts'
import { buildBracketView, readBattleName } from '~/bracket-view.ts'
import { toBattleKey } from '~/bracket.ts'
import type { BattleRef } from '~/bracket.ts'
import { formatTime } from '~/dates.ts'
import { formatCount } from '~/format-count.ts'
import { readArrangement } from '~/moves.ts'
import { listContenders, TOTAL_BATTLES } from '~/picks.ts'
import type { ResultRequest } from '~/result-request.ts'
import {
  clearResult,
  listDecidableBattles,
  readMergeMembers,
  recordMerge,
  recordResult,
} from '~/results.ts'
import type { Results, ResultsChange } from '~/results.ts'
import { toSeededBracket, withMerge } from '~/seeded-bracket.ts'
import type {
  SeededBracket,
  StoredBracket,
  StoredMerge,
} from '~/seeded-bracket.ts'

/**
 * The current year's bracket, each side a button that records its win. Each
 * change saves at once. The first result, a change, and a clear ask first
 */
export const ResultsEditor = ({
  year,
  bracket: stored,
  initialResults,
  isLocked,
}: {
  year: number
  bracket: StoredBracket
  initialResults: Results
  isLocked: boolean
}) => {
  const [results, setResults] = useState(initialResults)
  // A reload can drop a merge that these results still hold, such as after
  // another admin clears it
  const [knownMerges, setKnownMerges] = useState(stored.merges)
  const bracket = useMemo(() => {
    const winnerIds = new Set(Object.values(results))
    return toSeededBracket({
      ...stored,
      // The stored ones first, for their latest names
      merges: [...stored.merges, ...knownMerges].filter(({ id }) =>
        winnerIds.has(id),
      ),
    })
  }, [stored, knownMerges, results])
  const arrangement = useMemo(() => readArrangement(stored), [stored])
  const [cleared, setCleared] = useState<BattleRef[]>([])
  const [asking, setAsking] = useState<PendingChange | null>(null)
  const view = useMemo(
    () => buildBracketView(year, bracket, results),
    [year, bracket, results],
  )
  const { round, setRound, showBattle } = useShownRound(view)
  const revalidator = useRevalidator()
  const { state, isSending, send } = useRequestQueue<ResultRequest>(
    href(`/admin/results/save`),
  )
  // A later change builds on the last one, so it waits until that one saves
  const isBlocked =
    isSending || (state.kind !== `idle` && state.kind !== `sent`)

  const sendRequest = useCallback(
    (request: ResultRequest): void => {
      // The page reloads the phase and the lock before the next change
      send(request, () => revalidator.revalidate())
    },
    [send, revalidator],
  )
  const save = useCallback(
    ({ request, change, merge }: PendingChange): void => {
      if (merge) {
        setKnownMerges(current => [...current, merge])
      }
      setResults(change.results)
      setCleared(change.cleared)
      sendRequest(request)
    },
    [sendRequest],
  )
  const askOrSave = useCallback(
    (pending: PendingChange): void => {
      if (readQuestion(pending)) {
        setAsking(pending)
      } else {
        save(pending)
      }
    },
    [save],
  )
  const picking = useMemo(
    (): Picking => ({
      kind: `results`,
      pick: ({ round, index }, winnerId) => {
        if (isBlocked) {
          return
        }
        const pending = readPendingChange({
          year,
          arrangement,
          bracket,
          results,
          battle: { round, index },
          winnerId,
          isLocked,
        })
        askOrSave(pending)
      },
      listContenders: battle => listContenders(bracket, battle, results),
      isCleared: battle =>
        cleared.some(other => toBattleKey(other) === toBattleKey(battle)),
    }),
    [
      isBlocked,
      year,
      arrangement,
      bracket,
      results,
      isLocked,
      cleared,
      askOrSave,
    ],
  )
  const decidable = listDecidableBattles(bracket, results)
  const [nextBattle] = decidable
  const [firstMergeable, ...otherMergeable] = listMergeable(
    bracket,
    results,
    decidable,
  )
  return (
    <section className='flex flex-col gap-4'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-2'>
        <h2 className={SECTION_HEADING_CLASS_NAME}>Results</h2>
        <p className='max-w-prose text-muted'>
          Press a battle’s winner to record its result. Press them again to
          clear it.
        </p>
      </div>
      <div className='sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-white py-3 print:hidden'>
        <span className='font-condensed text-xl font-bold uppercase'>
          {`${Object.keys(results).length} of ${TOTAL_BATTLES} results`}
        </span>
        <SaveStatus state={state} onRetry={sendRequest} />
        {nextBattle ? (
          <Button variant='quiet' onPress={() => showBattle(nextBattle)}>
            Next battle to decide
          </Button>
        ) : null}
        {firstMergeable && (isSending || !isBlocked) ? (
          <MergeDialog
            bracket={bracket}
            mergeable={[firstMergeable, ...otherMergeable]}
            isPending={isSending}
            onMerge={(battle, name) =>
              askOrSave(
                readPendingMerge({
                  year,
                  arrangement,
                  bracket,
                  results,
                  battle,
                  name,
                  isLocked,
                }),
              )
            }
          />
        ) : null}
      </div>
      <ClearedNotice
        message={
          cleared.length > 0
            ? `Also cleared ${formatCount(cleared.length, `later result`)}: ${cleared.map(readBattleName).join(`, `)}.`
            : null
        }
      />
      <PickingContext value={picking}>
        <Bracket view={view} selection={{ round, onSelect: setRound }} />
      </PickingContext>
      {asking ? (
        <QuestionDialog
          asking={asking}
          bracket={asking.merge ? withMerge(bracket, asking.merge) : bracket}
          results={results}
          onConfirm={() => save(asking)}
          onClose={() => setAsking(null)}
        />
      ) : null}
    </section>
  )
}

type PendingChange = {
  request: ResultRequest
  change: ResultsChange
  merge?: StoredMerge
}

/** What to confirm first: locking, changing a result, or clearing one */
type Question = `lock` | `change` | `clear`

/** Pressing the recorded winner clears the result */
const readPendingChange = ({
  year,
  arrangement,
  bracket,
  results,
  battle,
  winnerId,
  isLocked,
}: {
  year: number
  arrangement: string
  bracket: SeededBracket
  results: Results
  battle: BattleRef
  winnerId: string
  isLocked: boolean
}): PendingChange => {
  const previousWinnerId = results[toBattleKey(battle)] ?? null
  const isClear = previousWinnerId === winnerId
  const change = isClear
    ? clearResult(bracket, results, battle)
    : recordResult(bracket, results, battle, winnerId)
  return {
    change,
    request: {
      year,
      arrangement,
      battle,
      winnerId: isClear ? null : winnerId,
      mergeName: null,
      previousWinnerId,
      cleared: change.cleared.map(toBattleKey),
      locks: !isLocked,
    },
  }
}

const readPendingMerge = ({
  year,
  arrangement,
  bracket,
  results,
  battle,
  name,
  isLocked,
}: {
  year: number
  arrangement: string
  bracket: SeededBracket
  results: Results
  battle: BattleRef
  name: string
  isLocked: boolean
}): PendingChange => {
  const merge = {
    id: crypto.randomUUID(),
    name,
    memberIds: readMergeMembers(bracket, results, battle)!,
  }
  return {
    merge,
    change: recordMerge(results, battle, merge.id),
    request: {
      year,
      arrangement,
      battle,
      winnerId: merge.id,
      mergeName: name,
      previousWinnerId: null,
      cleared: [],
      locks: !isLocked,
    },
  }
}

/** Null for a change to save without asking */
const readQuestion = ({ request }: PendingChange): Question | null => {
  if (request.winnerId === null) {
    return `clear`
  }
  if (request.previousWinnerId !== null) {
    return `change`
  }
  return request.locks ? `lock` : null
}

const QUESTION_TEXT: Record<Question, { title: string; confirmLabel: string }> =
  {
    lock: { title: `Lock submissions?`, confirmLabel: `Save result and lock` },
    change: { title: `Change this result?`, confirmLabel: `Change result` },
    clear: { title: `Clear this result?`, confirmLabel: `Clear result` },
  }

const QuestionDialog = ({
  asking,
  bracket,
  results,
  onConfirm,
  onClose,
}: {
  asking: PendingChange
  bracket: SeededBracket
  results: Results
  onConfirm: () => void
  onClose: () => void
}) => {
  const { request, change } = asking
  const question = readQuestion(asking)
  if (!question) {
    return null
  }
  const readName = (id: string | null | undefined): string =>
    bracket.combatantById.get(id ?? ``)?.name ?? ``
  const battleName = readBattleName(request.battle)
  const winner = readName(request.winnerId)
  const previous = readName(request.previousWinnerId)
  return (
    <ConfirmDialog
      isOpen
      onOpenChange={onClose}
      {...QUESTION_TEXT[question]}
      onConfirm={onConfirm}
    >
      <div className='flex flex-col gap-2'>
        {question === `lock` ? (
          <>
            <p>
              {`${battleName}: ${winner}. This is the first ${request.year} result, and saving it locks submissions. Players can’t start, edit, or submit a bracket, and educators can’t create contests.`}
            </p>
            <p>You can reopen submissions only after clearing every result.</p>
          </>
        ) : (
          <p>
            {question === `change`
              ? `${battleName}: ${winner} instead of ${previous}.`
              : `${battleName}: ${previous}.`}
          </p>
        )}
        {change.cleared.length > 0 ? (
          <>
            <p>
              {`This also clears ${formatCount(change.cleared.length, `later result`)} that depended on it:`}
            </p>
            <ul className='list-disc ps-5'>
              {change.cleared.map(battle => (
                <li key={toBattleKey(battle)}>
                  {`${readBattleName(battle)}: ${readName(results[toBattleKey(battle)])}`}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {question === `clear` ? <p>Submissions stay locked.</p> : null}
      </div>
    </ConfirmDialog>
  )
}

const SaveStatus = ({
  state,
  onRetry,
}: {
  state: RequestState<ResultRequest>
  onRetry: (request: ResultRequest) => void
}) => {
  switch (state.kind) {
    case `idle`:
      return <RequestNote>Results save as you go</RequestNote>
    case `sending`:
      return <RequestNote>Saving…</RequestNote>
    case `sent`:
      return <RequestNote>{`Saved at ${formatTime(state.at)}`}</RequestNote>
    case `failed`:
      return (
        <RequestAlert
          action={{
            label: `Try again`,
            onPress: () => onRetry(state.request),
          }}
        >
          Couldn’t save the result
        </RequestAlert>
      )
    case `locked`:
    case `refused`:
      return (
        <RequestAlert>Couldn’t save the result. Reload the page</RequestAlert>
      )
  }
}
