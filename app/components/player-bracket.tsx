import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { useRevalidator } from 'react-router'
import { Bracket } from './bracket.tsx'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { CopyButton } from './copy-button.tsx'
import { LocalTime } from './local-time.tsx'
import { ModalFrame } from './modal-frame.tsx'
import { Notice } from './notice.tsx'
import { PickingContext } from './picking.ts'
import type { Picking } from './picking.ts'
import { usePicksRequests } from './picks-requests.ts'
import type { RequestState } from './picks-requests.ts'
import type { BracketInput } from '~/bracket-input.ts'
import {
  buildBracketView,
  readBattleName,
  readStartingRound,
} from '~/bracket-view.ts'
import type { BracketView } from '~/bracket-view.ts'
import { listBattles, toBattleKey } from '~/bracket.ts'
import type { BattleRef, Round } from '~/bracket.ts'
import { formatDateTime, formatTime } from '~/dates.ts'
import type { SubmissionStatus } from '~/generated/prisma/enums.ts'
import type { PicksRequest } from '~/picks-request.ts'
import {
  arePicksEqual,
  listContenders,
  pickWinner,
  toPickBracket,
  TOTAL_BATTLES,
} from '~/picks.ts'
import type { Picks } from '~/picks.ts'
import type { Submission } from '~/player-picks.server.ts'

// The player's bracket, each battle a control. Every change saves the whole
// set of picks to the player's draft through `picksPath`, and submitting copies
// the draft to their submission
export const PlayerBracket = ({
  year,
  input,
  initialDraft,
  submitted,
  picksPath,
  forgetPath,
}: {
  year: number
  input: BracketInput
  initialDraft: Picks
  // Null until the player submits
  submitted: Submitted | null
  picksPath: string
  forgetPath: string
}) => {
  const submission = submitted?.submission ?? null
  const bracket = useMemo(() => toPickBracket(input), [input])
  const [picks, setPicks] = useState(initialDraft)
  // The panel after submitting shows until the player's next change
  const [justSubmitted, setJustSubmitted] = useState<
    `bracket` | `changes` | null
  >(null)
  const [isShowingUnpicked, setIsShowingUnpicked] = useState(false)
  // Every battle a change has cleared. One picked again shows as picked
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set())
  const [lastCleared, setLastCleared] = useState<BattleRef[]>([])
  const view = useMemo(
    () => buildBracketView(year, input, picks),
    [year, input, picks],
  )
  const { round, setRound, showBattle } = useShownRound(view)
  const { state, send } = usePicksRequests(picksPath)
  const revalidator = useRevalidator()
  // Counts the player's changes, so a submit that a later change overtakes
  // shows no panel
  const changeCount = useRef(0)

  const picking = useMemo(
    (): Picking => ({
      pick: (battle, winner) => {
        const next = pickWinner(bracket, picks, battle, winner)
        changeCount.current += 1
        setPicks(next.picks)
        setCleared(new Set([...cleared, ...next.cleared.map(toBattleKey)]))
        setLastCleared(next.cleared)
        setIsShowingUnpicked(false)
        setJustSubmitted(null)
        send({ intent: `save`, picks: next.picks })
      },
      listContenders: battle => listContenders(bracket, battle),
      isCleared: battle => {
        const key = toBattleKey(battle)
        return cleared.has(key) && picks[key] === undefined
      },
    }),
    [bracket, picks, cleared, send],
  )

  const unpicked = listBattles().filter(
    battle => picks[toBattleKey(battle)] === undefined,
  )
  const submit = (): void => {
    const [nextBattle] = unpicked
    if (nextBattle) {
      setIsShowingUnpicked(true)
      showBattle(nextBattle)
      return
    }
    // Shows the submission once the page has reloaded it
    const changeCountAtSubmit = changeCount.current
    send({ intent: `submit`, picks }, async () => {
      await revalidator.revalidate()
      if (changeCount.current === changeCountAtSubmit) {
        setJustSubmitted(submission ? `changes` : `bracket`)
      }
    })
  }
  // The picks go back at once, so a pick made while the discard is in flight
  // builds on the submitted picks, as the server's draft will
  const discard = (submitted: Submission): void => {
    changeCount.current += 1
    setPicks(submitted.picks)
    setCleared(new Set())
    setLastCleared([])
    setIsShowingUnpicked(false)
    send({ intent: `discard` })
  }

  const hasChanges =
    submission !== null && !arePicksEqual(picks, submission.picks)
  return (
    <PickingContext value={picking}>
      {submitted && justSubmitted ? (
        <SubmittedPanel
          {...submitted}
          kind={justSubmitted}
          forgetPath={forgetPath}
        />
      ) : null}
      {submission ? <PicksChanged at={submission.picksChangedAt} /> : null}
      <div className='sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-white py-3 print:hidden'>
        {submitted && !hasChanges ? (
          <>
            <BarLabel>{`Submitted · ${STATUS_TEXT[submitted.submission.status].label}`}</BarLabel>
            <RequestStatus state={state} />
            <BarActions>
              <PersonalLinkButton personalLink={submitted.personalLink} />
              <ForgetButton forgetPath={forgetPath} variant='quiet' />
            </BarActions>
          </>
        ) : (
          <>
            {hasChanges ? <BarLabel>Changes not submitted</BarLabel> : null}
            <PickProgress unpicked={unpicked} onShowBattle={showBattle} />
            <RequestStatus state={state} />
            <BarActions>
              {hasChanges ? (
                <DiscardButton onDiscard={() => discard(submission)} />
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
      {isShowingUnpicked && unpicked[0] ? (
        <div className='max-w-prose'>
          <Notice kind='alert'>
            {describeUnpicked(unpicked.length, unpicked[0], submission)}
          </Notice>
        </div>
      ) : null}
      <ClearedNotice cleared={lastCleared} />
      <Bracket view={view} selection={{ round, onSelect: setRound }} />
    </PickingContext>
  )
}

// A player's submission, and the personal link they see once they submit
export type Submitted = { submission: Submission; personalLink: string }

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

// Submitting changes keeps the submission's status
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
}: Submitted & {
  kind: `bracket` | `changes`
  forgetPath: string
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
        <ForgetButton forgetPath={forgetPath} variant='secondary' />
      </div>
    </section>
  )
}

const PersonalLink = ({ personalLink }: { personalLink: string }) => (
  <>
    <p>
      It opens your bracket on any device, now and after this computer forgets
      you. Paste it somewhere you’ll find it, such as a note or an email to
      yourself. Anyone with it can change your picks, so keep it to yourself.
    </p>
    <p className='border-2 border-ink bg-white p-3 font-mono text-xl break-all sm:text-2xl'>
      {personalLink}
    </p>
    <div>
      <CopyButton text={personalLink} />
    </div>
  </>
)

const PersonalLinkButton = ({ personalLink }: { personalLink: string }) => (
  <DialogTrigger>
    <Button variant='quiet'>Show my personal link</Button>
    <ModalFrame title='Your personal link'>
      <PersonalLink personalLink={personalLink} />
      <div className='mt-2 flex justify-end'>
        <Button slot='close' variant='secondary'>
          Close
        </Button>
      </div>
    </ModalFrame>
  </DialogTrigger>
)

const ForgetButton = ({
  forgetPath,
  variant,
}: {
  forgetPath: string
  variant: `quiet` | `secondary`
}) => (
  <ConfirmDialog
    trigger={<Button variant={variant}>Done, forget this computer</Button>}
    title='Forget this computer?'
    confirmLabel='Forget this computer'
    confirmVariant='primary'
    action={forgetPath}
  >
    <p>
      This computer will stop opening your bracket. To come back to it, you’ll
      need your personal link.
    </p>
  </ConfirmDialog>
)

const DiscardButton = ({ onDiscard }: { onDiscard: () => void }) => (
  <ConfirmDialog
    trigger={<Button variant='quiet'>Discard changes</Button>}
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

const PicksChanged = ({ at }: { at: Date }) => (
  <p className='text-muted'>
    Submitted picks last changed <LocalTime date={at} format={formatDateTime} />
    . If you didn’t make a change, tell your educator.
  </p>
)

// The round the tabs show, and a way to show and focus any battle, switching
// tabs when it's in another round
const useShownRound = (view: BracketView) => {
  const [round, setRound] = useState<Round>(() => readStartingRound(view))
  const battleToFocus = useRef<BattleRef>(undefined)
  useEffect(() => {
    if (battleToFocus.current) {
      focusBattle(battleToFocus.current)
      battleToFocus.current = undefined
    }
  }, [round])
  const showBattle = (battle: BattleRef): void => {
    if (battle.round === round) {
      focusBattle(battle)
    } else {
      // Focuses it once its round's tab renders
      battleToFocus.current = battle
      setRound(battle.round)
    }
  }
  return { round, setRound, showBattle }
}

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

// The live region stays in place, so its first message is announced
const ClearedNotice = ({ cleared }: { cleared: BattleRef[] }) => (
  <output
    className={
      cleared.length > 0
        ? `max-w-prose border-2 border-ink bg-white p-3`
        : `sr-only`
    }
  >
    {describeCleared(cleared)}
  </output>
)

const describeCleared = (cleared: BattleRef[]): string =>
  cleared.length === 0
    ? ``
    : `Your change cleared ${cleared.length} later ${cleared.length === 1 ? `pick` : `picks`} that depended on it: ${cleared.map(readBattleName).join(`, `)}.`

const RequestStatus = ({ state }: { state: RequestState }) => {
  switch (state.kind) {
    case `idle`:
      return <span className='text-muted'>Picks save as you go</span>
    case `sending`:
      return (
        <span className='text-muted'>{INTENT_TEXT[state.intent].sending}</span>
      )
    case `sent`:
      return (
        <span className='text-muted'>{`Saved at ${formatTime(state.at)}`}</span>
      )
    case `failed`:
      return (
        <span
          role='alert'
          className='flex items-center gap-2 font-semibold text-danger'
        >
          {`${INTENT_TEXT[state.intent].failed}. Your picks are still here`}
          <Button variant='quiet' onPress={state.retry}>
            Try again
          </Button>
        </span>
      )
    case `refused`:
      return (
        <span role='alert' className='font-semibold text-danger'>
          {`${INTENT_TEXT[state.intent].failed}. Reload the page to keep picking`}
        </span>
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

// Focuses the battle's first control in whichever layout is showing
const focusBattle = (battle: BattleRef): void => {
  const boxes = document.querySelectorAll<HTMLElement>(
    `[data-battle="${CSS.escape(toBattleKey(battle))}"]`,
  )
  const box = [...boxes].find(element => element.checkVisibility())
  box?.scrollIntoView({ block: `center`, inline: `center` })
  box?.querySelector<HTMLElement>(`input, button`)?.focus()
}
