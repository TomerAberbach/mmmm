import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRevalidator } from 'react-router'
import { Bracket } from './bracket.tsx'
import { Button } from './button.tsx'
import { ClearedNotice } from './cleared-notice.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { Notice } from './notice.tsx'
import { PickingContext } from './picking.ts'
import type { Picking } from './picking.ts'
import {
  DeleteButton,
  ForgetButton,
  PersonalLink,
  PersonalLinkButton,
  PicksChanged,
} from './player-controls.tsx'
import type { Submitted } from './player-controls.tsx'
import { useRequestQueue } from './request-queue.ts'
import type { QueueRules, RequestState } from './request-queue.ts'
import { RequestAlert, RequestNote } from './request-status.tsx'
import { useShownRound } from './shown-round.ts'
import { buildBracketView, readBattleName } from '~/bracket-view.ts'
import { listBattles, toBattleKey } from '~/bracket.ts'
import type { BattleRef } from '~/bracket.ts'
import { formatTime } from '~/dates.ts'
import { formatCount } from '~/format-count.ts'
import type { SubmissionStatus } from '~/generated/prisma/enums.ts'
import { readArrangement } from '~/moves.ts'
import { OTHER_PLAYER_STATUS } from '~/other-player.ts'
import type { PicksRequest } from '~/picks-request.ts'
import { arePicksEqual } from '~/picks.ts'
import type { Picks } from '~/picks.ts'
import type { Submission } from '~/player-picks.server.ts'
import { toSeededBracket } from '~/seeded-bracket.ts'
import type { StoredBracket } from '~/seeded-bracket.ts'
import { listContenders, setWinner, TOTAL_BATTLES } from '~/winners.ts'

/**
 * The player's bracket, each battle a control. Every change saves the whole
 * set of picks to the player's draft through `picksPath`, and submitting copies
 * the draft to their submission
 */
export const PlayerBracket = ({
  year,
  bracket: stored,
  initialDraft,
  submitted,
  hasClearedPicks,
  isOrphaned,
  picksPath,
  forgetPath,
  deletePath,
  playerId,
}: {
  year: number
  bracket: StoredBracket
  initialDraft: Picks
  /** Null until the player submits */
  submitted: Submitted | null
  /** Whether a move of combatants cleared picks since the player submitted */
  hasClearedPicks: boolean
  /** Whether the contest has no educator */
  isOrphaned: boolean
  picksPath: string
  forgetPath: string
  deletePath: string
  playerId: string
}) => {
  const submission = submitted?.submission ?? null
  const bracket = useMemo(() => toSeededBracket(stored), [stored])
  const arrangement = useMemo(() => readArrangement(stored), [stored])
  const [picks, setPicks] = useState(initialDraft)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Every battle a change has cleared. One picked again shows as picked
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set())
  const view = useMemo(
    () => buildBracketView(year, bracket, picks),
    [year, bracket, picks],
  )
  const { round, setRound, showBattle } = useShownRound(view)
  const { state, isSending, send } = useRequestQueue(
    picksPath,
    PICKS_QUEUE_RULES,
  )
  const revalidator = useRevalidator()
  // Counts the player's changes, so a submit that a later change overtakes
  // shows no panel
  const changeCount = useRef(0)

  const picking = useMemo(
    (): Picking => ({
      kind: `picks`,
      pick: (battle, winnerId) => {
        const next = setWinner(bracket, picks, battle, winnerId)
        changeCount.current += 1
        setPicks(next.winners)
        setCleared(new Set([...cleared, ...next.cleared.map(toBattleKey)]))
        setOutcome(
          next.cleared.length > 0
            ? { kind: `cleared`, battles: next.cleared }
            : null,
        )
        send({ intent: `save`, playerId, picks: next.winners, arrangement })
      },
      listContenders: battle => listContenders(bracket, battle),
      isCleared: battle => {
        const key = toBattleKey(battle)
        return cleared.has(key) && picks[key] === undefined
      },
    }),
    [bracket, arrangement, playerId, picks, cleared, send],
  )

  const unpicked = listBattles().filter(
    battle => picks[toBattleKey(battle)] === undefined,
  )
  const submit = (): void => {
    const [nextBattle] = unpicked
    if (nextBattle) {
      setOutcome({ kind: `unpicked` })
      showBattle(nextBattle)
      return
    }
    // Shows the submission once the page has reloaded it
    const changeCountAtSubmit = changeCount.current
    send({ intent: `submit`, playerId, picks, arrangement }, async () => {
      await revalidator.revalidate()
      if (changeCount.current === changeCountAtSubmit) {
        setOutcome({
          kind: `submitted`,
          submitted: submission ? `changes` : `bracket`,
        })
      }
    })
  }
  // The picks go back at once, so a pick made while the discard is in flight
  // builds on the submitted picks, as the server's draft will
  const discard = (): void => {
    if (!submission) {
      return
    }
    changeCount.current += 1
    setPicks(submission.picks)
    setCleared(new Set())
    setOutcome(null)
    send({ intent: `discard`, playerId })
  }

  /** Sends what the player would send now, not the picks that failed */
  const retries: Record<PicksRequest[`intent`], () => void> = {
    save: () => send({ intent: `save`, playerId, picks, arrangement }),
    submit: () => {
      // A change made after the submit failed may have left battles to pick,
      // and its own save may have failed
      if (unpicked.length > 0) {
        send({ intent: `save`, playerId, picks, arrangement })
      }
      submit()
    },
    discard,
  }

  const comeBack = describeComeBack(submitted !== null, isOrphaned)
  const hasChanges =
    submission !== null && !arePicksEqual(picks, submission.picks)
  return (
    <PickingContext value={picking}>
      {submitted && outcome?.kind === `submitted` ? (
        <SubmittedPanel
          {...submitted}
          kind={outcome.submitted}
          forgetPath={forgetPath}
          playerId={playerId}
          isSending={isSending}
        />
      ) : null}
      {hasClearedPicks ? (
        <div className='max-w-prose'>
          <Notice kind='alert'>
            The bracket changed, so some of your picks were cleared. Finish your
            bracket, then submit it.
          </Notice>
        </div>
      ) : null}
      {submission?.status === `REJECTED` && outcome?.kind !== `submitted` ? (
        <div className='max-w-prose'>
          <Notice kind='alert'>{STATUS_TEXT.REJECTED.note}</Notice>
        </div>
      ) : null}
      {submission ? <PicksChanged at={submission.picksChangedAt} /> : null}
      <div className='sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-white py-3 print:hidden'>
        {submitted && !hasChanges ? (
          <>
            <BarLabel>{`Submitted · ${STATUS_TEXT[submitted.submission.status].label}`}</BarLabel>
            <RequestStatus
              state={state}
              comeBack={comeBack}
              onRetry={intent => retries[intent]()}
              onReload={() => void revalidator.revalidate()}
            />
            <BarActions>
              <PersonalLinkButton personalLink={submitted.personalLink} />
              <ForgetButton
                forgetPath={forgetPath}
                playerId={playerId}
                variant='quiet'
                isSending={isSending}
              />
            </BarActions>
          </>
        ) : (
          <>
            {hasChanges ? <BarLabel>Changes not submitted</BarLabel> : null}
            <PickProgress unpicked={unpicked} onShowBattle={showBattle} />
            <RequestStatus
              state={state}
              comeBack={comeBack}
              onRetry={intent => retries[intent]()}
              onReload={() => void revalidator.revalidate()}
            />
            <BarActions>
              {hasChanges ? (
                <DiscardButton onDiscard={discard} isSending={isSending} />
              ) : null}
              <Button onPress={submit}>
                {hasChanges ? `Submit changes` : `Submit bracket`}
              </Button>
            </BarActions>
          </>
        )}
      </div>
      {hasChanges ? (
        <p className='max-w-prose'>
          Your submitted bracket still counts until you submit these changes.
        </p>
      ) : null}
      {outcome?.kind === `unpicked` && unpicked[0] ? (
        <div className='max-w-prose'>
          <Notice kind='alert'>
            {describeUnpicked(unpicked.length, unpicked[0], submission)}
          </Notice>
        </div>
      ) : null}
      <ClearedNotice
        message={describeCleared(
          outcome?.kind === `cleared` ? outcome.battles : [],
        )}
      />
      <Bracket view={view} selection={{ round, onSelect: setRound }} />
      <div className='print:hidden'>
        <DeleteButton
          deletePath={deletePath}
          playerId={playerId}
          isOrphaned={isOrphaned}
          isSending={isSending}
        />
      </div>
    </PickingContext>
  )
}

const PICKS_QUEUE_RULES: QueueRules<PicksRequest> = {
  // Each request holds the whole set of picks, or replaces it
  isReplaceable: ({ intent }) => intent === `save`,
  // A save doesn't submit. A save after a failed discard builds on the
  // submitted picks and replaces the draft, so discarding again would lose the
  // player's newer picks
  keepsFailure: (failed, next) =>
    failed.intent === `submit` && next.intent === `save`,
}

/**
 * The result of the player's latest action, shown until their next one: the
 * picks a change cleared, the battles left to pick before submitting, or the
 * panel after submitting
 */
type Outcome =
  | { kind: `cleared`; battles: BattleRef[] }
  | { kind: `unpicked` }
  | { kind: `submitted`; submitted: `bracket` | `changes` }

const BarLabel = ({ children }: { children: string }) => (
  <span className='font-condensed text-xl font-bold uppercase'>{children}</span>
)

const BarActions = ({ children }: { children: ReactNode }) => (
  <span className='ms-auto flex flex-wrap items-center gap-3'>{children}</span>
)

const describeUnpicked = (
  count: number,
  nextBattle: BattleRef,
  submission: Submission | null,
): string => {
  const battles = count === 1 ? `battle` : `${count} battles`
  const next = `Next up: ${readBattleName(nextBattle)}.`
  return submission
    ? `Pick the last ${battles} to submit your changes. ${next} Your submitted bracket still counts until then.`
    : `Pick the last ${battles} to submit. ${next}`
}

/** Submitting changes keeps the submission's status */
const STATUS_TEXT: Record<SubmissionStatus, { label: string; note: string }> = {
  PENDING: {
    label: `waiting for approval`,
    note: `Your educator will approve your bracket before it counts.`,
  },
  APPROVED: {
    label: `approved`,
    note: `Your educator approved your bracket, and it stays approved.`,
  },
  REJECTED: {
    label: `not approved`,
    note: `Your educator didn’t approve your bracket. You can ask them about it.`,
  },
}

const SubmittedPanel = ({
  submission,
  personalLink,
  kind,
  forgetPath,
  playerId,
  isSending,
}: Submitted & {
  kind: `bracket` | `changes`
  forgetPath: string
  playerId: string
  isSending: boolean
}) => {
  const headingId = useId()
  // Moves focus to the panel, so a screen reader announces it
  const focusOnMount = useCallback((heading: HTMLHeadingElement | null) => {
    heading?.focus()
  }, [])
  return (
    <section
      aria-labelledby={headingId}
      className='flex max-w-2xl flex-col gap-5 border-4 border-accent p-6'
    >
      <div className='flex flex-col gap-1'>
        <h2
          id={headingId}
          ref={focusOnMount}
          tabIndex={-1}
          className='font-condensed text-3xl font-extrabold uppercase outline-none'
        >
          {kind === `bracket` ? `Bracket submitted` : `Changes submitted`}
        </h2>
        <p>
          {`${STATUS_TEXT[submission.status].note} Until the first battle’s result, you can change your picks and submit them again.`}
        </p>
      </div>
      <div className='flex flex-col gap-3'>
        <h3 className='font-condensed text-2xl font-bold uppercase'>
          Save your personal link
        </h3>
        <PersonalLink personalLink={personalLink} />
      </div>
      <div className='flex flex-col items-start gap-2 border-t-2 border-muted-light pt-4'>
        <p>On a shared computer? Forget your bracket here when you’re done.</p>
        <ForgetButton
          forgetPath={forgetPath}
          playerId={playerId}
          variant='secondary'
          isSending={isSending}
        />
      </div>
    </section>
  )
}

const DiscardButton = ({
  onDiscard,
  isSending,
}: {
  onDiscard: () => void
  /** A submit still in flight would change which picks discarding brings back */
  isSending: boolean
}) => (
  <ConfirmDialog
    trigger={
      <Button variant='quiet' isDisabled={isSending}>
        Discard changes
      </Button>
    }
    title='Discard your changes?'
    confirmLabel='Discard changes'
    onConfirm={onDiscard}
  >
    <p>
      Your picks go back to the bracket you submitted. The changes can’t be
      brought back.
    </p>
  </ConfirmDialog>
)

const PickProgress = ({
  unpicked,
  onShowBattle,
}: {
  unpicked: BattleRef[]
  onShowBattle: (battle: BattleRef) => void
}) => {
  const nextBattle = unpicked[0]
  return (
    <>
      <span className='font-condensed text-xl font-bold uppercase'>
        {`${TOTAL_BATTLES - unpicked.length} of ${TOTAL_BATTLES} picked`}
      </span>
      {nextBattle ? (
        <Button variant='quiet' onPress={() => onShowBattle(nextBattle)}>
          Next battle to pick
        </Button>
      ) : null}
    </>
  )
}

const describeCleared = (cleared: BattleRef[]): string | null =>
  cleared.length === 0
    ? null
    : `Your change cleared ${formatCount(cleared.length, `later pick`)} that depended on it: ${cleared.map(readBattleName).join(`, `)}.`

/** How a player comes back to their bracket once the browser forgets them */
const describeComeBack = (
  hasPersonalLink: boolean,
  isOrphaned: boolean,
): string => {
  if (hasPersonalLink) {
    return `. Open your personal link to go back to yours`
  }
  // Without an educator, a player who hasn't submitted has no way back
  return isOrphaned
    ? ``
    : `. Ask your educator for your personal link to go back to yours`
}

const RequestStatus = ({
  state,
  comeBack,
  onRetry,
  onReload,
}: {
  state: RequestState<PicksRequest>
  comeBack: string
  onRetry: (intent: PicksRequest[`intent`]) => void
  onReload: () => void
}) => {
  switch (state.kind) {
    case `idle`:
      return <RequestNote>Picks save as you go</RequestNote>
    case `sending`:
      return (
        <RequestNote>{INTENT_TEXT[state.request.intent].sending}</RequestNote>
      )
    case `sent`:
      return <RequestNote>{`Saved at ${formatTime(state.at)}`}</RequestNote>
    case `failed`: {
      const { intent } = state.request
      return (
        <RequestAlert
          action={{ label: `Try again`, onPress: () => onRetry(intent) }}
        >
          {intent === `discard`
            ? INTENT_TEXT.discard.failed
            : `${INTENT_TEXT[intent].failed}. Your picks are still here`}
        </RequestAlert>
      )
    }
    case `locked`:
      return (
        <RequestAlert action={{ label: `Reload`, onPress: onReload }}>
          {`Submissions just closed. ${INTENT_TEXT[state.request.intent].failed}`}
        </RequestAlert>
      )
    case `refused`:
      return (
        <RequestAlert>
          {state.status === OTHER_PLAYER_STATUS
            ? `${INTENT_TEXT[state.request.intent].failed}. This device opens another player’s bracket now${comeBack}`
            : `${INTENT_TEXT[state.request.intent].failed}. Reload the page to keep picking`}
        </RequestAlert>
      )
  }
}

const INTENT_TEXT: Record<
  PicksRequest[`intent`],
  { sending: string; failed: string }
> = {
  save: { sending: `Saving…`, failed: `Couldn’t save` },
  submit: { sending: `Submitting…`, failed: `Couldn’t submit` },
  discard: { sending: `Discarding…`, failed: `Couldn’t discard your changes` },
}
